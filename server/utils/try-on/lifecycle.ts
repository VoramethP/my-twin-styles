import { and, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import * as t from '../../db/schema'
import type { Db, Tx } from '../db'
import type { TryOnAdapter, TryOnResult } from './adapter'
import type { RenderSlot } from '#shared/outfit'

// retry 1 ครั้ง = ส่งให้ provider ได้สูงสุด 2 รอบ (Q22 · ADR-0002)
export const MAX_ATTEMPTS = 2
// งานที่ส่งแล้วไม่มีผลกลับภายในเวลานี้ ถือว่า timeout
export const RUNNING_TIMEOUT_MS = 3 * 60_000
// งานที่จองโควต้าแล้วแต่ส่งไม่ออก (route ล่มกลางทาง) รอเท่านี้ก่อนให้ cron ส่งแทน
export const QUEUED_GRACE_MS = 60_000

type Conn = Db | Tx
export type Signer = (bucket: 'poses' | 'items', path: string) => Promise<string>

export interface TryOnRefs {
  userId: string
  posePath: string | null
  garments: { slot: RenderSlot, path: string | null }[]
}

// อ่าน path ของท่าและชิ้นที่ render — ใช้ได้ทั้งใน tx ของผู้ใช้ (ผ่าน RLS) และในโซนสิทธิ์พิเศษ
export async function loadTryOnRefs(db: Conn, tryOnId: string): Promise<TryOnRefs> {
  const [row] = await db.select({ userId: t.tryOns.userId, posePath: t.poses.storagePath })
    .from(t.tryOns).leftJoin(t.poses, eq(t.poses.id, t.tryOns.poseId))
    .where(eq(t.tryOns.id, tryOnId))
  if (!row) throw new Error(`try_on ${tryOnId} not found`)
  const garments = await db.select({ slot: t.tryOnItems.slot, path: t.items.imagePath })
    .from(t.tryOnItems).leftJoin(t.items, eq(t.items.id, t.tryOnItems.itemId))
    .where(and(eq(t.tryOnItems.tryOnId, tryOnId), sql`${t.tryOnItems.slot} <> 'accessory'`))
  return { userId: row.userId, posePath: row.posePath, garments: garments as TryOnRefs['garments'] }
}

// ส่งงานให้ provider — คืน null ถ้าท่าหรือชิ้นถูกลบไปแล้ว (ส่งไม่ได้ ต้องจบเป็น failed)
export async function submitToProvider(o: { adapter: TryOnAdapter, sign: Signer, tryOnId: string, refs: TryOnRefs, callbackUrl: string }) {
  if (!o.refs.posePath || o.refs.garments.some(g => !g.path)) return null
  const poseImageUrl = await o.sign('poses', o.refs.posePath)
  const garments = await Promise.all(o.refs.garments.map(async g => ({ slot: g.slot, imageUrl: await o.sign('items', g.path!) })))
  return o.adapter.submit({ tryOnId: o.tryOnId, poseImageUrl, garments, callbackUrl: o.callbackUrl })
}

// ── ส่วนล่างนี้ทำงานในโซนสิทธิ์พิเศษเท่านั้น (ADR-0005) — db คือ connection เจ้าของตาราง ──

export interface PrivilegedDeps {
  db: Db
  adapter: TryOnAdapter
  sign: Signer
  callbackUrl: string
  // ดาวน์โหลดรูปจาก provider แล้วเก็บลง bucket looks/<userId>/… คืน path
  storeLook: (userId: string, tryOnId: string, imageUrl: string) => Promise<string>
  notify?: (userId: string, event: { tryOnId: string, status: 'succeeded' | 'failed', lookId?: string }) => Promise<void>
}

export async function failTryOn(deps: PrivilegedDeps, tryOnId: string, errorCode: string) {
  const [row] = await deps.db.update(t.tryOns)
    .set({ status: 'failed', errorCode, finishedAt: new Date() })
    .where(and(eq(t.tryOns.id, tryOnId), inArray(t.tryOns.status, ['queued', 'running'])))
    .returning({ userId: t.tryOns.userId })
  if (!row) return
  await deps.db.execute(sql`select public.refund_quota(${tryOnId})`)
  await deps.notify?.(row.userId, { tryOnId, status: 'failed' })
}

// ส่งใหม่ถ้ายังเหลือรอบ ไม่งั้นจบเป็น failed + คืนโควต้า
export async function resubmitOrFail(deps: PrivilegedDeps, tryOnId: string, reason: string) {
  const [row] = await deps.db.select({ attempts: t.tryOns.attempts, status: t.tryOns.status })
    .from(t.tryOns).where(eq(t.tryOns.id, tryOnId))
  if (!row || (row.status !== 'queued' && row.status !== 'running')) return
  if (row.attempts >= MAX_ATTEMPTS) return failTryOn(deps, tryOnId, reason)
  const refs = await loadTryOnRefs(deps.db, tryOnId)
  let submission
  try {
    submission = await submitToProvider({ ...deps, tryOnId, refs })
  }
  catch {
    submission = undefined
  }
  if (submission === null) return failTryOn(deps, tryOnId, 'source_deleted')
  // ส่งไม่ออกก็นับเป็นหนึ่งรอบ — กัน cron วนส่งไม่รู้จบ
  await deps.db.update(t.tryOns).set({
    status: 'running',
    attempts: row.attempts + 1,
    submittedAt: new Date(),
    provider: deps.adapter.name,
    providerJobId: submission?.providerJobId ?? null,
    errorCode: submission ? null : 'submit_failed',
  }).where(eq(t.tryOns.id, tryOnId))
}

// webhook: ต้อง idempotent — provider อาจยิงซ้ำ หรือผลของรอบเก่ามาถึงหลังส่งรอบใหม่แล้ว
export async function handleResult(deps: PrivilegedDeps, result: TryOnResult) {
  const [row] = await deps.db.select({ id: t.tryOns.id, userId: t.tryOns.userId, status: t.tryOns.status })
    .from(t.tryOns).where(eq(t.tryOns.providerJobId, result.providerJobId))
  if (!row || row.status !== 'running') return { handled: false as const }

  if (result.status === 'failed') {
    await resubmitOrFail(deps, row.id, result.errorCode)
    return { handled: true as const }
  }
  // user_id มาจากแถวในฐานข้อมูล ไม่ใช่จาก payload (ADR-0005)
  const imagePath = await deps.storeLook(row.userId, row.id, result.imageUrl)
  const lookId = await deps.db.transaction(async (tx) => {
    const [look] = await tx.insert(t.looks).values({ userId: row.userId, tryOnId: row.id, imagePath })
      .onConflictDoNothing().returning({ id: t.looks.id })
    await tx.update(t.tryOns).set({ status: 'succeeded', finishedAt: new Date(), errorCode: null })
      .where(eq(t.tryOns.id, row.id))
    return look?.id
  })
  await deps.notify?.(row.userId, { tryOnId: row.id, status: 'succeeded', lookId })
  return { handled: true as const, lookId }
}

// cron: เก็บงานที่ค้าง — ส่งไม่ออกตั้งแต่แรก หรือส่งแล้วเงียบเกินเวลา
export async function reconcileStuck(deps: PrivilegedDeps, now = new Date()) {
  const stuck = await deps.db.select({ id: t.tryOns.id }).from(t.tryOns).where(or(
    and(eq(t.tryOns.status, 'queued'), lt(t.tryOns.createdAt, new Date(now.getTime() - QUEUED_GRACE_MS))),
    and(eq(t.tryOns.status, 'running'), isNotNull(t.tryOns.submittedAt),
      lt(t.tryOns.submittedAt, new Date(now.getTime() - RUNNING_TIMEOUT_MS))),
  )).limit(50)
  for (const s of stuck) await resubmitOrFail(deps, s.id, 'timeout')
  return stuck.length
}
