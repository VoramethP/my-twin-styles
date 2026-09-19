import type { H3Event } from 'h3'
import type { TryOnAdapter } from './adapter'
import { createMockAdapter } from './mock'

export * from './adapter'

// เลือก adapter จาก NUXT_TRY_ON_PROVIDER — ตอนนี้มีแค่ mock จนกว่าจะเลือกเจ้าจริง (ต้องมี ADR)
export function getTryOnAdapter(event: H3Event): TryOnAdapter {
  const config = useRuntimeConfig(event)
  if (config.tryOnProvider === 'mock') {
    // กันลืมเปิด mock บน production — ผู้ใช้จะได้รูป placeholder แทนลุคจริง
    if (process.env.VERCEL_ENV === 'production') throw new Error('mock try-on adapter ห้ามใช้บน production')
    return createMockAdapter({
      webhookSecret: config.tryOnWebhookSecret,
      placeholderImageUrl: `${config.public.siteUrl}/mock/look-placeholder.svg`,
      failRate: Number(config.tryOnMockFailRate) || 0,
    })
  }
  throw new Error(`ยังไม่รองรับ try-on provider: ${config.tryOnProvider}`)
}
export * from './lifecycle'
