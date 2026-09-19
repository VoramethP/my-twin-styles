import { count, eq } from 'drizzle-orm'
import { evaluatePose, savePoseSchema } from '#shared/pose'
import { poses } from '../db/schema'
import { withUserDb } from '../utils/db'
import { getPoseCheckAdapter } from '../utils/pose-check'
import { assertOwnPath, userStorageSigner } from '../utils/storage'

// S02 → S03: เช็กรูปท่าที่อัปโหลดแล้ว — ผ่าน (หรือยอมรับคำเตือน) จึงบันทึกเป็นท่า
export default defineEventHandler(async (event) => {
  const parsed = savePoseSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'invalid_body', data: parsed.error.issues })
  const body = parsed.data
  const sign = await userStorageSigner(event)
  const adapter = getPoseCheckAdapter(event)

  return withUserDb(event, async (tx, userId) => {
    assertOwnPath(userId, body.storagePath)
    const result = evaluatePose(body, await adapter.check(await sign('poses', body.storagePath)))
    if (result.blocks.length || (result.warnings.length && !body.acceptWarnings)) {
      return { saved: false as const, ...result }
    }
    const [{ n }] = await tx.select({ n: count() }).from(poses).where(eq(poses.userId, userId)) as [{ n: number }]
    try {
      const [pose] = await tx.insert(poses).values({
        userId,
        storagePath: body.storagePath,
        quality: result.warnings.length ? 'warn' : 'ok',
        warnings: result.warnings,
        sortOrder: n + 1,
      }).returning({ id: poses.id, sortOrder: poses.sortOrder })
      return { saved: true as const, ...result, pose: pose!, total: n + 1 }
    }
    catch (err) {
      if (String((err as { cause?: Error })?.cause?.message ?? err).includes('pose_limit_reached')) {
        throw createError({ statusCode: 409, statusMessage: 'pose_limit_reached', message: 'twin มีได้ไม่เกิน 5 ท่า' })
      }
      throw err
    }
  })
})
