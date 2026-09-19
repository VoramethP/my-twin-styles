import { describe, expect, it } from 'vitest'
import { evaluatePose } from '#shared/pose'

const none = { blocks: [], warnings: [] }

describe('evaluatePose — เช็กคุณภาพรูปท่า (Q21)', () => {
  it('รูปใหญ่พอและสว่างพอ ผ่าน', () => {
    expect(evaluatePose({ width: 1200, height: 1600, brightness: 0.5 }, none)).toEqual(none)
  })
  it('ด้านสั้นเล็กกว่า 512 → บล็อก', () => {
    expect(evaluatePose({ width: 400, height: 900, brightness: 0.5 }, none).blocks).toEqual(['too_small'])
  })
  it('มืด → เตือน ไม่บล็อก', () => {
    const r = evaluatePose({ width: 1200, height: 1600, brightness: 0.1 }, none)
    expect(r).toEqual({ blocks: [], warnings: ['dark'] })
  })
  it('รวมผลจาก AI และไม่ซ้ำ', () => {
    const r = evaluatePose({ width: 1200, height: 1600, brightness: 0.1 }, { blocks: ['not_full_body'], warnings: ['dark', 'busy_background'] })
    expect(r.blocks).toEqual(['not_full_body'])
    expect(r.warnings.sort()).toEqual(['busy_background', 'dark'])
  })
})
