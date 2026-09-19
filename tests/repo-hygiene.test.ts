import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// repo นี้ public — กัน secret หลุดเข้า git (skill repo-hygiene)
const root = join(__dirname, '..')
const SECRET_PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]{10,}/, // Supabase secret key
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, // JWT (legacy service_role/anon key)
  /sk-[A-Za-z0-9_-]{20,}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]

describe('repo hygiene', () => {
  it('.env.example มีแต่ placeholder', () => {
    const text = readFileSync(join(root, '.env.example'), 'utf8')
    for (const re of SECRET_PATTERNS) expect(text).not.toMatch(re)
    const values = text.split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => l.slice(l.indexOf('=') + 1))
    for (const v of values) {
      const looksFake = v === '' || /x{6,}|y{6,}|localhost|^mock$|^0$/.test(v)
      expect(looksFake, `ค่าใน .env.example ดูเหมือนของจริง: ${v.slice(0, 12)}…`).toBe(true)
    }
  })
  it('ไม่มีไฟล์ .env จริงถูก track', () => {
    const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n')
    expect(tracked.filter(f => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'))).toEqual([])
  })
  it('ไฟล์ที่ track ไม่มีรูปแบบ secret', () => {
    const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(f => !f.endsWith('.drawio') && !f.startsWith('public/') && f !== 'package-lock.json')
    const hits = tracked.filter((f) => {
      const text = readFileSync(join(root, f), 'utf8')
      return SECRET_PATTERNS.some(re => re.test(text))
    })
    expect(hits).toEqual([])
  })
})
