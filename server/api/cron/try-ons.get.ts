// โซนสิทธิ์พิเศษ (ADR-0005): เรียกโดยตัวตั้งเวลาเท่านั้น — ตรวจ CRON_SECRET ก่อนทำอะไร
import { timingSafeEqual } from 'node:crypto'
import { reconcileStuck } from '../../utils/try-on'
import { openPrivilegedDb, privilegedLifecycleDeps } from '../../utils/privileged'

export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig(event).cronSecret
  const got = Buffer.from(getHeader(event, 'authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
  const { db, close } = openPrivilegedDb(event)
  try {
    return { reconciled: await reconcileStuck(privilegedLifecycleDeps(event, db)) }
  }
  finally {
    await close()
  }
})
