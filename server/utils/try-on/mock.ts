import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { InvalidWebhookSignature, type TryOnAdapter, type TryOnRequest, type TryOnResult } from './adapter'

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature'

export interface MockOptions {
  webhookSecret: string
  placeholderImageUrl: string
  delayMs?: number
  failRate?: number // 0–1 ใช้ทดสอบ flow ล้มเหลว → retry → คืนโควต้า
  random?: () => number
  deliver?: (url: string, body: string, headers: Record<string, string>) => Promise<void>
  schedule?: (fn: () => void, ms: number) => void
}

export function signMockBody(secret: string, body: string) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

// จำลอง provider แบบ async: รับงาน → หน่วงเวลา → ยิง webhook ที่ลงลายเซ็นกลับมา
// ใช้ได้แค่ตอนพัฒนา — ไม่ส่งรูปท่ากลับเป็นผลลัพธ์ (คืนรูป placeholder เสมอ)
export function createMockAdapter(opts: MockOptions): TryOnAdapter {
  const random = opts.random ?? Math.random
  const schedule = opts.schedule ?? ((fn, ms) => { setTimeout(fn, ms) })
  const deliver = opts.deliver ?? (async (url, body, headers) => {
    await fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } })
  })

  return {
    name: 'mock',
    async submit(req: TryOnRequest) {
      const providerJobId = `mock_${randomUUID()}`
      const result: TryOnResult = random() < (opts.failRate ?? 0)
        ? { providerJobId, status: 'failed', errorCode: 'mock_failure' }
        : { providerJobId, status: 'succeeded', imageUrl: opts.placeholderImageUrl }
      const body = JSON.stringify(result)
      schedule(() => {
        deliver(req.callbackUrl, body, { [MOCK_SIGNATURE_HEADER]: signMockBody(opts.webhookSecret, body) })
          .catch(err => console.error('[mock try-on] ส่ง webhook ไม่สำเร็จ', err))
      }, opts.delayMs ?? 3000)
      return { providerJobId }
    },
    parseWebhook(headers, rawBody) {
      const got = headers[MOCK_SIGNATURE_HEADER] ?? ''
      const want = signMockBody(opts.webhookSecret, rawBody)
      const a = Buffer.from(got)
      const b = Buffer.from(want)
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InvalidWebhookSignature()
      return JSON.parse(rawBody) as TryOnResult
    },
  }
}
