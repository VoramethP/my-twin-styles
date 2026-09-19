import { and, count, eq, inArray } from 'drizzle-orm'
import { items, looks, poses } from '../../db/schema'
import { withUserDb } from '../../utils/db'

// S04: ความคืบหน้า onboarding ① ท่า ② ชิ้น (เสื้อ+ท่อนล่าง หรือเดรส) ③ ลุคแรก
export default defineEventHandler(event => withUserDb(event, async (tx, userId) => {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0
  const [poseCount, topCount, bottomCount, dressCount, lookCount] = await Promise.all([
    n(tx.select({ n: count() }).from(poses).where(eq(poses.userId, userId))),
    n(tx.select({ n: count() }).from(items).where(and(eq(items.userId, userId), eq(items.slot, 'top')))),
    n(tx.select({ n: count() }).from(items).where(and(eq(items.userId, userId), eq(items.slot, 'bottom')))),
    n(tx.select({ n: count() }).from(items).where(and(eq(items.userId, userId), inArray(items.slot, ['dress'])))),
    n(tx.select({ n: count() }).from(looks).where(eq(looks.userId, userId))),
  ])
  return {
    poses: poseCount,
    hasTwin: poseCount > 0,
    hasOutfitItems: (topCount > 0 && bottomCount > 0) || dressCount > 0,
    hasLook: lookCount > 0,
  }
}))
