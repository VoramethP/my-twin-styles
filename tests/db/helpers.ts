import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

// ต่อ Postgres ที่ผ่าน migration แล้ว (tests/db/run-local.sh) — ในฐานะเจ้าของตาราง
export const url = process.env.TEST_DATABASE_URL
export const sql = url ? postgres(url, { prepare: false, max: 4, onnotice: () => {} }) : (null as unknown as postgres.Sql)

// 🔴 ตรวจ RLS ต้องทำในฐานะ authenticated เท่านั้น — owner ข้าม RLS ทั้งหมด
// set local ต้องอยู่ใน transaction ไม่งั้นไม่มีผลและไม่ error (stack-setup)
export function asUser<T>(uid: string, fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: 'authenticated' })}, true)`
    await tx`set local role authenticated`
    return fn(tx)
  }) as Promise<T>
}

export function asAnon<T>(fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx`set local role anon`
    return fn(tx)
  }) as Promise<T>
}

export async function newUser(quota?: number) {
  const id = randomUUID()
  await sql`insert into auth.users (id, email, raw_user_meta_data) values (${id}, ${`${id}@test.local`}, '{"full_name":"ทดสอบ"}')`
  if (quota !== undefined) await sql`update public.profiles set daily_quota = ${quota} where user_id = ${id}`
  return id
}

// ท่า 1 + เสื้อ 1 + ท่อนล่าง 1 ของผู้ใช้ — ใส่ผ่าน RLS ในนามผู้ใช้เอง
export async function seedWardrobe(uid: string) {
  return asUser(uid, async (tx) => {
    const [pose] = await tx`insert into public.poses (user_id, storage_path, quality, sort_order)
      values (${uid}, ${`${uid}/pose1.jpg`}, 'ok', 1) returning id`
    const [top] = await tx`insert into public.items (user_id, image_path, original_path, category, slot)
      values (${uid}, ${`${uid}/top.png`}, ${`${uid}/top-orig.jpg`}, 'เสื้อเชิ้ต', 'top') returning id`
    const [bottom] = await tx`insert into public.items (user_id, image_path, original_path, category, slot)
      values (${uid}, ${`${uid}/bottom.png`}, ${`${uid}/bottom-orig.jpg`}, 'กางเกง', 'bottom') returning id`
    return { poseId: pose!.id as string, topId: top!.id as string, bottomId: bottom!.id as string }
  })
}

export function outfitJson(w: { topId: string, bottomId: string }) {
  return JSON.stringify([{ slot: 'top', item_id: w.topId }, { slot: 'bottom', item_id: w.bottomId }])
}

export function startTryOn(uid: string, w: { poseId: string, topId: string, bottomId: string }) {
  return asUser(uid, async tx => (await tx`select public.start_try_on(${w.poseId}, ${outfitJson(w)}::text::jsonb) as id`)[0]!.id as string)
}

// เพดานรวมเป็นของทั้งระบบ — ตั้งให้เหลือพอสำหรับเทสต์แล้วคืนค่าเดิม
export async function withGlobalCapHeadroom<T>(headroom: number, fn: () => Promise<T>) {
  const [{ cap }] = await sql`select global_daily_cap as cap from public.app_settings where id = 1` as unknown as [{ cap: number }]
  const [{ used }] = await sql`select coalesce((select used from public.global_usage
    where day = (now() at time zone 'Asia/Bangkok')::date), 0) as used` as unknown as [{ used: number }]
  await sql`update public.app_settings set global_daily_cap = ${used + headroom} where id = 1`
  try { return await fn() }
  finally { await sql`update public.app_settings set global_daily_cap = ${cap} where id = 1` }
}
