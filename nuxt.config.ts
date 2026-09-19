// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'th' },
      title: 'my-twin-styles',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
    },
  },
  supabase: {
    // ทุกหน้าต้องล็อกอิน ยกเว้นหน้าแชร์สาธารณะ (S14) และหน้าเข้าสู่ระบบ
    redirectOptions: { login: '/login', callback: '/auth/confirm', exclude: ['/l/*'] },
  },
  runtimeConfig: {
    databaseUrl: '', // NUXT_DATABASE_URL — Supabase pooler (transaction mode)
    supabaseSecretKey: '', // NUXT_SUPABASE_SECRET_KEY — อ่านได้ที่ server/utils/privileged.ts ที่เดียว (ADR-0005)
    tryOnProvider: 'mock', // NUXT_TRY_ON_PROVIDER — ยังไม่เลือกเจ้าจริง
    tryOnWebhookSecret: '', // NUXT_TRY_ON_WEBHOOK_SECRET
    tryOnMockFailRate: '0', // NUXT_TRY_ON_MOCK_FAIL_RATE — 0–1 ใช้ทดสอบ flow ล้มเหลว
    cronSecret: '', // NUXT_CRON_SECRET
    public: {
      siteUrl: 'http://localhost:3000', // NUXT_PUBLIC_SITE_URL — ใช้สร้าง callback URL ให้ provider
    },
  },
  routeRules: {
    // หน้าแชร์: ตรวจ token ทุกครั้ง เพิกถอนแล้วต้องตายทันที — ห้ามแคช (ADR-0003)
    '/l/**': { headers: { 'cache-control': 'no-store' } },
    // route ที่อ่าน session ห้ามแคชเด็ดขาด (stack-setup: cache poisoning) — ไม่มี isr/swr/prerender ที่ไหนเลย
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },
})
