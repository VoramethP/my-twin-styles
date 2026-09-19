import { z } from 'zod'

// เช็กคุณภาพรูปท่า (Q21): ❌ บล็อก = ผลลองพังแน่ · ⚠️ เตือน = ใช้ต่อได้แต่ผลอาจเพี้ยน
export const MAX_POSES = 5
export const MIN_SHORT_SIDE = 512 // px — เล็กกว่านี้ AI render รายละเอียดชุดไม่ได้
export const DARK_BRIGHTNESS = 0.25 // ความสว่างเฉลี่ย 0–1

export const POSE_BLOCKS = {
  too_small: 'รูปเล็กเกินไป — ถ่ายใหม่ให้ชัดขึ้น',
  not_full_body: 'ไม่เห็นเต็มตัว — ถอยห่างอีกนิดให้เห็นถึงเท้า',
  multiple_people: 'มีหลายคนในรูป — ถ่ายให้มีแค่คุณคนเดียว',
} as const
export const POSE_WARNINGS = {
  dark: 'แสงค่อนข้างมืด — ผลอาจเพี้ยน',
  busy_background: 'พื้นหลังรก — ผลอาจเพี้ยน',
  loose_clothing: 'ชุดที่ใส่หลวมหรือหนา — สัดส่วนอาจคลาดเคลื่อน',
} as const
export type PoseBlock = keyof typeof POSE_BLOCKS
export type PoseWarning = keyof typeof POSE_WARNINGS

// ค่าที่เบราว์เซอร์วัดได้เอง — ไม่ต้องใช้ AI
export const poseMetricsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  brightness: z.number().min(0).max(1),
})
export type PoseMetrics = z.infer<typeof poseMetricsSchema>

export interface PoseCheckResult { blocks: PoseBlock[], warnings: PoseWarning[] }

export function evaluatePose(metrics: PoseMetrics, ai: PoseCheckResult): PoseCheckResult {
  const blocks = new Set<PoseBlock>(ai.blocks)
  const warnings = new Set<PoseWarning>(ai.warnings)
  if (Math.min(metrics.width, metrics.height) < MIN_SHORT_SIDE) blocks.add('too_small')
  if (metrics.brightness < DARK_BRIGHTNESS) warnings.add('dark')
  return { blocks: [...blocks], warnings: [...warnings] }
}

export const savePoseSchema = poseMetricsSchema.extend({
  storagePath: z.string().min(1).max(300),
  // ผู้ใช้เห็นคำเตือนแล้วกด "ใช้รูปนี้" — ไม่มีผลกับข้อที่บล็อก
  acceptWarnings: z.boolean().default(false),
})
