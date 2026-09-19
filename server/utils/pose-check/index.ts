import type { H3Event } from 'h3'
import type { PoseCheckResult } from '#shared/pose'

// เช็กที่ต้องใช้ AI (เต็มตัว · หลายคน · พื้นหลัง · ชุดหลวม) — ห่อไว้หลัง adapter เหมือน try-on (ADR-0001)
// ยังไม่เลือกเจ้า → mock ผ่านเสมอ (เช็กขนาด/ความมืดทำจริงใน shared/pose.ts)
export interface PoseCheckAdapter {
  readonly name: string
  check(imageUrl: string): Promise<PoseCheckResult>
}

export const mockPoseCheck: PoseCheckAdapter = {
  name: 'mock',
  async check() { return { blocks: [], warnings: [] } },
}

export function getPoseCheckAdapter(event: H3Event): PoseCheckAdapter {
  const provider = useRuntimeConfig(event).tryOnProvider
  if (provider === 'mock') return mockPoseCheck
  throw new Error(`ยังไม่รองรับ pose check provider: ${provider}`)
}
