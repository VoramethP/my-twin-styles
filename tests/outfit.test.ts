import { describe, expect, it } from 'vitest'
import { outfitSchema, renderEntries } from '#shared/outfit'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const outfit = (items: [string, number][]) => ({ poseId: id(99), items: items.map(([slot, n]) => ({ slot, itemId: id(n) })) })

describe('outfitSchema — กติกาช่อง (CONTEXT.md)', () => {
  it('เสื้อ + ท่อนล่าง ผ่าน', () => {
    expect(outfitSchema.safeParse(outfit([['top', 1], ['bottom', 2]])).success).toBe(true)
  })
  it('เดรสอย่างเดียว + ชั้นนอก + ส่วนประกอบ ผ่าน', () => {
    expect(outfitSchema.safeParse(outfit([['dress', 1], ['outer', 2], ['accessory', 3], ['accessory', 4]])).success).toBe(true)
  })
  it('ไม่มีท่อนล่างและไม่มีเดรส ไม่ผ่าน', () => {
    expect(outfitSchema.safeParse(outfit([['top', 1]])).success).toBe(false)
  })
  it('เดรสซ้อนกับเสื้อ ไม่ผ่าน', () => {
    expect(outfitSchema.safeParse(outfit([['dress', 1], ['top', 2]])).success).toBe(false)
  })
  it('ช่องเดียวกันสองชิ้น ไม่ผ่าน', () => {
    expect(outfitSchema.safeParse(outfit([['top', 1], ['top', 2], ['bottom', 3]])).success).toBe(false)
  })
  it('ชิ้นเดียวกันซ้ำ ไม่ผ่าน', () => {
    expect(outfitSchema.safeParse(outfit([['top', 1], ['bottom', 2], ['accessory', 2]])).success).toBe(false)
  })
  it('ส่วนประกอบเกิน 5 ไม่ผ่าน', () => {
    const acc: [string, number][] = [10, 11, 12, 13, 14, 15].map(n => ['accessory', n])
    expect(outfitSchema.safeParse(outfit([['top', 1], ['bottom', 2], ...acc])).success).toBe(false)
  })
  it('renderEntries ไม่ส่งส่วนประกอบให้ AI', () => {
    const o = outfitSchema.parse(outfit([['top', 1], ['bottom', 2], ['accessory', 3]]))
    expect(renderEntries(o).map(e => e.slot)).toEqual(['top', 'bottom'])
  })
})
