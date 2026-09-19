import { z } from 'zod'

// ช่องที่ AI render ลงตัว — accessory เป็น "ส่วนประกอบ" แนบดูคู่แต่ไม่ render (CONTEXT.md)
export const RENDER_SLOTS = ['top', 'bottom', 'outer', 'dress'] as const
export const SLOTS = [...RENDER_SLOTS, 'accessory'] as const
export type RenderSlot = typeof RENDER_SLOTS[number]
export type Slot = typeof SLOTS[number]

export const MAX_ACCESSORIES = 5

const outfitEntry = z.object({ slot: z.enum(SLOTS), itemId: z.uuid() })

// ชุด (Outfit) = ท่า + ชิ้นตามช่อง — คำสั่งก่อน generate ไม่ใช่ผลลัพธ์
export const outfitSchema = z.object({
  poseId: z.uuid(),
  items: z.array(outfitEntry).min(1),
  remixOfLookId: z.uuid().optional(),
}).superRefine((o, ctx) => {
  const count = (s: Slot) => o.items.filter(i => i.slot === s).length
  for (const s of RENDER_SLOTS) {
    if (count(s) > 1) ctx.addIssue({ code: 'custom', message: `ช่อง ${s} ใส่ได้ชิ้นเดียว`, path: ['items'] })
  }
  if (count('accessory') > MAX_ACCESSORIES) {
    ctx.addIssue({ code: 'custom', message: `ส่วนประกอบได้ไม่เกิน ${MAX_ACCESSORIES} ชิ้น`, path: ['items'] })
  }
  const hasDress = count('dress') === 1
  if (hasDress && (count('top') > 0 || count('bottom') > 0)) {
    ctx.addIssue({ code: 'custom', message: 'เดรสแทนเสื้อ + ท่อนล่างแล้ว ใส่ซ้อนไม่ได้', path: ['items'] })
  }
  if (!hasDress && !(count('top') === 1 && count('bottom') === 1)) {
    ctx.addIssue({ code: 'custom', message: 'ชุดต้องมี เสื้อ + ท่อนล่าง หรือ เดรส', path: ['items'] })
  }
  const ids = o.items.map(i => i.itemId)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: 'ใส่ชิ้นเดียวกันซ้ำไม่ได้', path: ['items'] })
  }
})
export type Outfit = z.infer<typeof outfitSchema>

// ชิ้นที่ต้องส่งให้ AI — ส่วนประกอบไม่ถูกส่ง
export function renderEntries(outfit: Outfit) {
  return outfit.items.filter((i): i is { slot: RenderSlot, itemId: string } => i.slot !== 'accessory')
}
