import { sql } from 'drizzle-orm'
import { outfitSchema } from '#shared/outfit'
import { withUserDb } from '../utils/db'
import { userStorageSigner } from '../utils/storage'
import { getTryOnAdapter, loadTryOnRefs, submitToProvider } from '../utils/try-on'

// ข้อผิดพลาดจาก start_try_on() → HTTP ที่ UI แสดงผลได้
const START_ERRORS: Record<string, { statusCode: number, message: string }> = {
  quota_exceeded: { statusCode: 429, message: 'โควต้าวันนี้หมดแล้ว ลองใหม่พรุ่งนี้' },
  global_cap_reached: { statusCode: 503, message: 'วันนี้ระบบเต็มแล้ว ลองใหม่พรุ่งนี้' },
  pose_not_found: { statusCode: 404, message: 'ไม่พบท่าที่เลือก' },
  item_not_found: { statusCode: 404, message: 'ไม่พบชิ้นที่เลือก' },
  look_not_found: { statusCode: 404, message: 'ไม่พบลุคต้นทาง' },
}

function startError(err: unknown) {
  const text = [err, (err as { cause?: unknown })?.cause].map(e => (e as Error)?.message ?? '').join(' ')
  const key = Object.keys(START_ERRORS).find(k => text.includes(k))
  return key ? createError({ ...START_ERRORS[key]!, statusMessage: key }) : err
}

export default defineEventHandler(async (event) => {
  const parsed = outfitSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'invalid_outfit', data: parsed.error.issues })
  const outfit = parsed.data
  const adapter = getTryOnAdapter(event)
  const config = useRuntimeConfig(event)

  // 1) จองโควต้า + สร้างการลอง (commit ก่อนส่งงาน เพื่อให้ webhook ที่มาเร็วหาแถวเจอ)
  const { id, refs } = await withUserDb(event, async (tx) => {
    // ส่งเป็น text แล้วค่อย cast — ถ้า cast เป็น jsonb ตรง ๆ driver จะ JSON-encode ซ้ำจนกลายเป็น scalar
    const items = JSON.stringify(outfit.items.map(i => ({ slot: i.slot, item_id: i.itemId })))
    let rows
    try {
      rows = await tx.execute<{ id: string }>(sql`select public.start_try_on(${outfit.poseId}, ${items}::text::jsonb, ${outfit.remixOfLookId ?? null}) as id`)
    }
    catch (err) {
      throw startError(err)
    }
    const id = rows[0]!.id
    return { id, refs: await loadTryOnRefs(tx, id) }
  })

  // 2) ส่งให้ provider ด้วย signed URL ที่ผู้ใช้สร้างเองได้ผ่าน storage RLS — ส่งไม่ออกก็ปล่อยเป็น queued ให้ cron ส่งแทน
  const sign = await userStorageSigner(event)
  try {
    const submission = await submitToProvider({
      adapter, tryOnId: id, refs, sign, callbackUrl: `${config.public.siteUrl}/api/webhooks/try-on`,
    })
    if (submission) {
      await withUserDb(event, tx => tx.execute(sql`select public.mark_try_on_submitted(${id}, ${adapter.name}, ${submission.providerJobId})`))
    }
  }
  catch (err) {
    console.error('[try-ons] ส่งงานให้ provider ไม่สำเร็จ — cron จะส่งใหม่', { tryOnId: id, err })
  }
  setResponseStatus(event, 202)
  return { id }
})
