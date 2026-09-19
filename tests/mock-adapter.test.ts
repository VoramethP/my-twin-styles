import { describe, expect, it } from 'vitest'
import { InvalidWebhookSignature } from '../server/utils/try-on/adapter'
import { createMockAdapter, MOCK_SIGNATURE_HEADER } from '../server/utils/try-on/mock'

function setup(random: number) {
  const sent: { url: string, body: string, headers: Record<string, string> }[] = []
  const adapter = createMockAdapter({
    webhookSecret: 'test-secret',
    placeholderImageUrl: 'http://localhost/mock/look-placeholder.svg',
    failRate: 0.5,
    random: () => random,
    schedule: fn => fn(),
    deliver: async (url, body, headers) => { sent.push({ url, body, headers }) },
  })
  return { adapter, sent }
}
const req = { tryOnId: 't1', poseImageUrl: 'https://signed/pose', garments: [], callbackUrl: 'http://localhost/api/webhooks/try-on' }

describe('mock try-on adapter', () => {
  it('ยิง webhook ที่ลงลายเซ็น และ parse กลับได้', async () => {
    const { adapter, sent } = setup(0.9)
    const { providerJobId } = await adapter.submit(req)
    await Promise.resolve()
    expect(sent).toHaveLength(1)
    const result = adapter.parseWebhook(sent[0]!.headers, sent[0]!.body)
    expect(result).toEqual({ providerJobId, status: 'succeeded', imageUrl: 'http://localhost/mock/look-placeholder.svg' })
  })
  it('ไม่คืนรูปท่าเป็นผลลัพธ์ (ADR-0003)', async () => {
    const { adapter, sent } = setup(0.9)
    await adapter.submit(req)
    await Promise.resolve()
    expect(sent[0]!.body).not.toContain('signed/pose')
  })
  it('จำลองความล้มเหลวตาม failRate', async () => {
    const { adapter, sent } = setup(0.1)
    await adapter.submit(req)
    await Promise.resolve()
    expect(JSON.parse(sent[0]!.body)).toMatchObject({ status: 'failed', errorCode: 'mock_failure' })
  })
  it('ลายเซ็นผิดหรือ body ถูกแก้ → ปฏิเสธ', async () => {
    const { adapter, sent } = setup(0.9)
    await adapter.submit(req)
    await Promise.resolve()
    const { body, headers } = sent[0]!
    expect(() => adapter.parseWebhook({ [MOCK_SIGNATURE_HEADER]: 'nope' }, body)).toThrow(InvalidWebhookSignature)
    expect(() => adapter.parseWebhook(headers, body.replace('succeeded', 'failed'))).toThrow(InvalidWebhookSignature)
    expect(() => adapter.parseWebhook({}, body)).toThrow(InvalidWebhookSignature)
  })
})
