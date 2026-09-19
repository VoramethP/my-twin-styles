// โซนสิทธิ์พิเศษ (ADR-0005): ไม่มี session ผู้ใช้ — เชื่อได้เฉพาะ payload ที่ลายเซ็นถูกต้อง
import { getTryOnAdapter, handleResult, InvalidWebhookSignature } from '../../utils/try-on'
import { openPrivilegedDb, privilegedLifecycleDeps } from '../../utils/privileged'

export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  const adapter = getTryOnAdapter(event)
  let result
  try {
    result = adapter.parseWebhook(getRequestHeaders(event), raw)
  }
  catch (err) {
    if (err instanceof InvalidWebhookSignature) throw createError({ statusCode: 401, statusMessage: 'invalid_signature' })
    throw err
  }
  const { db, close } = openPrivilegedDb(event)
  try {
    return await handleResult(privilegedLifecycleDeps(event, db), result)
  }
  finally {
    await close()
  }
})
