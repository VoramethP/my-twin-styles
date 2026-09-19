import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import type { TryOnAdapter, TryOnRequest } from '../../server/utils/try-on/adapter'
import { handleResult, reconcileStuck, RUNNING_TIMEOUT_MS, type PrivilegedDeps } from '../../server/utils/try-on/lifecycle'
import { newUser, seedWardrobe, sql, startTryOn, url, withGlobalCapHeadroom } from './helpers'

// lifecycle ในโซนสิทธิ์พิเศษ: webhook สำเร็จ/ล้มเหลว → retry 1 ครั้ง → คืนโควต้า (Q22 · ADR-0002 · ADR-0005)
describe.skipIf(!url)('try-on lifecycle', () => {
  afterAll(async () => { await sql?.end() })

  function deps() {
    const submitted: TryOnRequest[] = []
    const notified: unknown[] = []
    let n = 0
    const adapter: TryOnAdapter = {
      name: 'fake',
      async submit(req) { submitted.push(req); return { providerJobId: `job_${req.tryOnId}_${++n}` } },
      parseWebhook() { throw new Error('unused') },
    }
    const d: PrivilegedDeps = {
      db: drizzle({ client: sql, schema }),
      adapter,
      callbackUrl: 'http://localhost/api/webhooks/try-on',
      sign: async (bucket, path) => `https://signed/${bucket}/${path}`,
      storeLook: async (userId, tryOnId) => `${userId}/${tryOnId}.png`,
      notify: async (userId, e) => { notified.push({ userId, ...e }) },
    }
    return { d, submitted, notified }
  }

  async function started() {
    const uid = await newUser()
    const w = await seedWardrobe(uid)
    const id = await withGlobalCapHeadroom(5, () => startTryOn(uid, w))
    return { uid, id }
  }
  const usage = async (uid: string) => (await sql`select used from public.daily_usage where user_id = ${uid}`)[0]!.used

  it('งานที่ส่งไม่ออก → cron ส่งแทน โดยเซ็น URL ท่า + ชิ้นที่ render', async () => {
    const { id } = await started()
    await sql`update public.try_ons set created_at = now() - interval '5 minutes' where id = ${id}`
    const { d, submitted } = deps()
    await reconcileStuck(d)
    const req = submitted.find(r => r.tryOnId === id)!
    expect(req.poseImageUrl).toMatch(/^https:\/\/signed\/poses\//)
    expect(req.garments.map(g => g.slot).sort()).toEqual(['bottom', 'top'])
    const [row] = await sql`select status, attempts from public.try_ons where id = ${id}`
    expect(row).toMatchObject({ status: 'running', attempts: 1 })
  })

  it('สำเร็จ → มีลุค · สถานะ succeeded · webhook ซ้ำไม่สร้างลุคซ้ำ', async () => {
    const { uid, id } = await started()
    await sql`update public.try_ons set status = 'running', attempts = 1, provider_job_id = ${`job_${id}`}, submitted_at = now() where id = ${id}`
    const { d, notified } = deps()
    const r = await handleResult(d, { providerJobId: `job_${id}`, status: 'succeeded', imageUrl: 'https://provider/out.png' })
    expect(r.handled).toBe(true)
    const again = await handleResult(d, { providerJobId: `job_${id}`, status: 'succeeded', imageUrl: 'https://provider/out.png' })
    expect(again.handled).toBe(false)
    expect(await sql`select id from public.looks where try_on_id = ${id}`).toHaveLength(1)
    expect(notified).toContainEqual(expect.objectContaining({ userId: uid, status: 'succeeded' }))
    expect(await usage(uid)).toBe(1) // สำเร็จ = ไม่คืนโควต้า
  })

  it('ล้มเหลวรอบแรก → retry · ล้มเหลวรอบสอง → failed + คืนโควต้า', async () => {
    const { uid, id } = await started()
    await sql`update public.try_ons set status = 'running', attempts = 1, provider_job_id = ${`job_${id}`}, submitted_at = now() where id = ${id}`
    const { d, submitted, notified } = deps()
    await handleResult(d, { providerJobId: `job_${id}`, status: 'failed', errorCode: 'provider_error' })
    const [mid] = await sql`select status, attempts, provider_job_id from public.try_ons where id = ${id}`
    expect(mid).toMatchObject({ status: 'running', attempts: 2 })
    expect(submitted).toHaveLength(1)
    // ผลของรอบเก่ามาถึงช้า → ไม่สนใจ
    expect((await handleResult(d, { providerJobId: `job_${id}`, status: 'failed', errorCode: 'late' })).handled).toBe(false)
    await handleResult(d, { providerJobId: mid!.provider_job_id, status: 'failed', errorCode: 'provider_error' })
    const [end] = await sql`select status, quota_refunded from public.try_ons where id = ${id}`
    expect(end).toMatchObject({ status: 'failed', quota_refunded: true })
    expect(await usage(uid)).toBe(0)
    expect(notified).toContainEqual(expect.objectContaining({ userId: uid, status: 'failed' }))
  })

  it('ส่งแล้วเงียบเกินเวลาครบ 2 รอบ → cron จบเป็น failed + คืนโควต้า', async () => {
    const { uid, id } = await started()
    const old = new Date(Date.now() - RUNNING_TIMEOUT_MS - 60_000).toISOString()
    await sql`update public.try_ons set status = 'running', attempts = 2, provider_job_id = ${`job_${id}`}, submitted_at = ${old} where id = ${id}`
    await reconcileStuck(deps().d)
    const [row] = await sql`select status, error_code, quota_refunded from public.try_ons where id = ${id}`
    expect(row).toMatchObject({ status: 'failed', error_code: 'timeout', quota_refunded: true })
    expect(await usage(uid)).toBe(0)
  })

  it('ท่าถูกลบระหว่างรอ → จบเป็น failed + คืนโควต้า (ไม่ส่งงานที่ไม่มีท่า)', async () => {
    const { uid, id } = await started()
    await sql`delete from public.poses where user_id = ${uid}`
    await sql`update public.try_ons set created_at = now() - interval '5 minutes' where id = ${id}`
    const { d, submitted } = deps()
    await reconcileStuck(d)
    expect(submitted.find(r => r.tryOnId === id)).toBeUndefined()
    const [row] = await sql`select status, error_code from public.try_ons where id = ${id}`
    expect(row).toMatchObject({ status: 'failed', error_code: 'source_deleted' })
  })
})
