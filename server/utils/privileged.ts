// ⚠️ โซนสิทธิ์พิเศษ (ADR-0005) — ที่เดียวในระบบที่อ่าน secret key ได้
// ผู้เรียกที่อนุญาต: server/api/webhooks/** · server/api/cron/** · server/utils/push.ts
// route ที่มี session ผู้ใช้ห้าม import ไฟล์นี้ (tests/privileged-imports.test.ts ตรวจอยู่)
// user_id ต้องมาจากแถว try_ons ในฐานข้อมูลเสมอ — ห้ามเชื่อ payload ภายนอก
import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { openDb, type Db } from './db'
import { getTryOnAdapter } from './try-on'
import type { PrivilegedDeps } from './try-on/lifecycle'

// Drizzle ในฐานะเจ้าของตาราง (ข้าม RLS) — ปิดด้วย close() ทุกครั้ง
export function openPrivilegedDb(event: H3Event) {
  return openDb(event)
}

// Storage ด้วย secret key — ใช้เก็บรูปลุคที่ได้จาก provider และสร้าง signed URL ให้ provider
export function privilegedStorage(event: H3Event) {
  const config = useRuntimeConfig(event)
  const url = process.env.SUPABASE_URL
  if (!url || !config.supabaseSecretKey) throw new Error('ยังไม่ได้ตั้ง SUPABASE_URL / NUXT_SUPABASE_SECRET_KEY')
  return createClient(url, config.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage
}

// ประกอบ dependency ของ lifecycle สำหรับ webhook / cron
export function privilegedLifecycleDeps(event: H3Event, db: Db): PrivilegedDeps {
  const storage = privilegedStorage(event)
  const config = useRuntimeConfig(event)
  return {
    db,
    adapter: getTryOnAdapter(event),
    callbackUrl: `${config.public.siteUrl}/api/webhooks/try-on`,
    async sign(bucket, path) {
      const { data, error } = await storage.from(bucket).createSignedUrl(path, 600)
      if (error || !data) throw error ?? new Error('sign failed')
      return data.signedUrl
    },
    async storeLook(userId, tryOnId, imageUrl) {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`ดาวน์โหลดผลลัพธ์ไม่ได้: ${res.status}`)
      const type = res.headers.get('content-type') ?? 'image/png'
      const ext = type.includes('svg') ? 'svg' : type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png'
      const path = `${userId}/${tryOnId}.${ext}`
      const { error } = await storage.from('looks').upload(path, await res.arrayBuffer(), { contentType: type, upsert: true })
      if (error) throw error
      return path
    },
    // Web Push ยังไม่ได้ทำ (ต้องมี VAPID key) — ตอนนี้แอปเห็นผลจากการ์ด ⏳ ใน Lookbook
  }
}
