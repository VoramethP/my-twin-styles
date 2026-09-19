import { defineConfig } from 'drizzle-kit'

// migration ด้วย drizzle-kit generate + migrate เท่านั้น — ห้าม push (ลบ RLS policy ได้เงียบ ๆ) · FDR-0009
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
  dbCredentials: { url: process.env.NUXT_DATABASE_URL ?? '' },
})
