import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// ADR-0005: secret key ใช้ได้ที่ server/utils/privileged.ts ที่เดียว และเรียกได้จากโซนที่อนุญาตเท่านั้น
const ALLOWED = [/^server\/utils\/privileged\.ts$/, /^server\/api\/webhooks\//, /^server\/api\/cron\//, /^server\/api\/share\//, /^server\/utils\/push\.ts$/]
const PRIVILEGED = /utils\/privileged|openPrivilegedDb|privilegedStorage|privilegedLifecycleDeps|supabaseSecretKey|SUPABASE_SECRET_KEY|serverSupabaseServiceRole/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('โซนสิทธิ์พิเศษ (ADR-0005)', () => {
  const root = join(__dirname, '..')
  const files = [...walk(join(root, 'server')), ...walk(join(root, 'app')), ...walk(join(root, 'shared'))]
    .map(f => relative(root, f)).filter(f => /\.(ts|vue)$/.test(f))

  it('ไม่มีไฟล์นอกโซนที่อนุญาตแตะของสิทธิ์พิเศษ', () => {
    const offenders = files.filter(f => !ALLOWED.some(a => a.test(f)) && PRIVILEGED.test(readFileSync(join(root, f), 'utf8')))
    expect(offenders).toEqual([])
  })
  it('ไม่มีที่ไหนใช้ serverSupabaseServiceRole เลย (stack-setup)', () => {
    const offenders = files.filter(f => readFileSync(join(root, f), 'utf8').includes('serverSupabaseServiceRole('))
    expect(offenders).toEqual([])
  })
})
