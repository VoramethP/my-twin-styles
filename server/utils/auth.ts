import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

// ใช้ getUser() เสมอสำหรับการกันสิทธิ์ — ยิงถาม Auth server จริง (cookie ปลอมได้) · stack-setup
export async function requireUser(event: H3Event) {
  const client = await serverSupabaseClient(event)
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  return data.user
}
