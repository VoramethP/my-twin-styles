import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

// signed URL ในนามผู้ใช้ — storage RLS อนุญาตเฉพาะโฟลเดอร์ของตัวเอง จึงไม่ต้องใช้สิทธิ์พิเศษ
export async function userStorageSigner(event: H3Event) {
  const storage = (await serverSupabaseClient(event)).storage
  return async (bucket: 'poses' | 'items' | 'looks', path: string, expiresIn = 600) => {
    const { data, error } = await storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error || !data) throw error ?? new Error('sign failed')
    return data.signedUrl
  }
}

// path ต้องอยู่ในโฟลเดอร์ของผู้ใช้เสมอ (<user_id>/…) — กันผู้ใช้อ้าง path ของคนอื่น
export function assertOwnPath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`) || path.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'invalid_path' })
  }
}
