import { afterAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, newUser, outfitJson, seedWardrobe, sql, startTryOn, url, withGlobalCapHeadroom } from './helpers'

describe.skipIf(!url)('RLS + โควต้า บน Postgres จริง (ADR-0002, ADR-0003)', () => {
  afterAll(async () => { await sql?.end() })

  it('ทุกตารางใน public เปิด RLS', async () => {
    const rows = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`
    expect(rows.map(r => r.relname)).toEqual([])
  })

  it('สมัครใหม่ → มี profile พร้อมโควต้าตั้งต้น', async () => {
    const uid = await newUser()
    const [p] = await asUser(uid, tx => tx`select daily_quota, role from public.profiles`)
    expect(p).toMatchObject({ daily_quota: 5, role: 'user' })
  })

  it('INSERT ... RETURNING ผ่านในนามเจ้าของ (ต้องผ่าน SELECT policy ด้วย)', async () => {
    const uid = await newUser()
    const w = await seedWardrobe(uid)
    expect(w.poseId).toBeTruthy()
  })

  it('คนอื่นมองไม่เห็นท่าและชิ้นของเรา · anon ไม่เห็นอะไรเลย', async () => {
    const a = await newUser()
    const b = await newUser()
    await seedWardrobe(a)
    expect(await asUser(b, tx => tx`select id from public.poses where user_id = ${a}`)).toHaveLength(0)
    expect(await asUser(b, tx => tx`select id from public.items where user_id = ${a}`)).toHaveLength(0)
    expect(await asAnon(tx => tx`select id from public.poses`)).toHaveLength(0)
  })

  it('แก้ role/daily_quota ของตัวเองไม่ได้ แต่แก้ display_name ได้', async () => {
    const uid = await newUser()
    await expect(asUser(uid, tx => tx`update public.profiles set daily_quota = 999 where user_id = ${uid}`)).rejects.toThrow(/permission denied/)
    await expect(asUser(uid, tx => tx`update public.profiles set role = 'admin' where user_id = ${uid}`)).rejects.toThrow(/permission denied/)
    await asUser(uid, tx => tx`update public.profiles set display_name = 'ใหม่' where user_id = ${uid}`)
    const [p] = await sql`select display_name from public.profiles where user_id = ${uid}`
    expect(p!.display_name).toBe('ใหม่')
  })

  it('สร้าง try_on ตรง ๆ ไม่ได้ — ต้องผ่าน start_try_on() (จองโควต้า)', async () => {
    const uid = await newUser()
    const w = await seedWardrobe(uid)
    await expect(asUser(uid, tx => tx`insert into public.try_ons (user_id, pose_id, quota_day)
      values (${uid}, ${w.poseId}, current_date)`)).rejects.toThrow(/row-level security/)
  })

  it('โควต้ารายคน: ครบแล้วสั่งต่อไม่ได้', async () => {
    const uid = await newUser(2)
    const w = await seedWardrobe(uid)
    await withGlobalCapHeadroom(10, async () => {
      await startTryOn(uid, w)
      await startTryOn(uid, w)
      await expect(startTryOn(uid, w)).rejects.toThrow(/quota_exceeded/)
    })
    const [u] = await sql`select used from public.daily_usage where user_id = ${uid}`
    expect(u!.used).toBe(2)
  })

  it('เพดานรวมเต็ม → ไม่สร้างการลอง และ rollback โควต้ารายคน', async () => {
    const uid = await newUser(5)
    const w = await seedWardrobe(uid)
    await withGlobalCapHeadroom(1, async () => {
      await startTryOn(uid, w)
      await expect(startTryOn(uid, w)).rejects.toThrow(/global_cap_reached/)
    })
    const [u] = await sql`select used from public.daily_usage where user_id = ${uid}`
    expect(u!.used).toBe(1)
    const tries = await sql`select id from public.try_ons where user_id = ${uid}`
    expect(tries).toHaveLength(1)
  })

  it('ใช้ท่าหรือชิ้นของคนอื่นลองไม่ได้', async () => {
    const a = await newUser()
    const b = await newUser()
    const wa = await seedWardrobe(a)
    const wb = await seedWardrobe(b)
    await withGlobalCapHeadroom(5, async () => {
      await expect(startTryOn(b, { ...wb, poseId: wa.poseId })).rejects.toThrow(/pose_not_found/)
      await expect(asUser(b, tx => tx`select public.start_try_on(${wb.poseId}, ${outfitJson({ topId: wa.topId, bottomId: wb.bottomId })}::text::jsonb)`))
        .rejects.toThrow(/item_not_found/)
    })
  })

  it('refund_quota: ผู้ใช้เรียกเองไม่ได้ · คืนได้ครั้งเดียวและเฉพาะงานที่ failed', async () => {
    const uid = await newUser()
    const w = await seedWardrobe(uid)
    const id = await withGlobalCapHeadroom(5, () => startTryOn(uid, w))
    await expect(asUser(uid, tx => tx`select public.refund_quota(${id})`)).rejects.toThrow(/permission denied/)
    expect((await sql`select public.refund_quota(${id}) as ok`)[0]!.ok).toBe(false) // ยังไม่ failed
    await sql`update public.try_ons set status = 'failed' where id = ${id}`
    expect((await sql`select public.refund_quota(${id}) as ok`)[0]!.ok).toBe(true)
    expect((await sql`select public.refund_quota(${id}) as ok`)[0]!.ok).toBe(false) // คืนซ้ำไม่ได้
    const [u] = await sql`select used from public.daily_usage where user_id = ${uid}`
    expect(u!.used).toBe(0)
  })

  it('twin มีได้ไม่เกิน 5 ท่า', async () => {
    const uid = await newUser()
    await asUser(uid, async (tx) => {
      for (let i = 1; i <= 5; i++) await tx`insert into public.poses (user_id, storage_path, quality, sort_order) values (${uid}, ${`${uid}/p${i}`}, 'ok', ${i})`
    })
    await expect(asUser(uid, tx => tx`insert into public.poses (user_id, storage_path, quality, sort_order) values (${uid}, ${`${uid}/p6`}, 'ok', 6)`))
      .rejects.toThrow(/pose_limit_reached/)
  })

  it('admin_stats: ผู้ใช้ทั่วไปเรียกไม่ได้ · แอดมินได้ตัวเลขเท่านั้น (ไม่มี path รูป)', async () => {
    const uid = await newUser()
    await expect(asUser(uid, tx => tx`select public.admin_stats()`)).rejects.toThrow(/forbidden/)
    await sql`update public.profiles set role = 'admin' where user_id = ${uid}`
    const [r] = await asUser(uid, tx => tx`select public.admin_stats() as s`)
    expect(JSON.stringify(r!.s)).not.toMatch(/path|\.jpg|\.png/)
    expect(r!.s).toHaveProperty('try_ons_today')
  })

  it('storage: เขียนได้เฉพาะโฟลเดอร์ตัวเอง · bucket looks เขียนเองไม่ได้', async () => {
    const a = await newUser()
    const b = await newUser()
    await asUser(a, tx => tx`insert into storage.objects (bucket_id, name) values ('poses', ${`${a}/p.jpg`})`)
    await expect(asUser(a, tx => tx`insert into storage.objects (bucket_id, name) values ('poses', ${`${b}/p.jpg`})`)).rejects.toThrow(/row-level security/)
    await expect(asUser(a, tx => tx`insert into storage.objects (bucket_id, name) values ('looks', ${`${a}/l.png`})`)).rejects.toThrow(/row-level security/)
    expect(await asUser(b, tx => tx`select name from storage.objects where name like ${`${a}/%`}`)).toHaveLength(0)
  })
})
