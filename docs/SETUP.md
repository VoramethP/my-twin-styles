# Setup — ต่อ Supabase จริง + deploy

ทำครั้งเดียวต่อ environment · ค่าจริงทั้งหมดอยู่ใน `.env` (เครื่อง) หรือ env ของ Vercel — **ห้าม commit** (repo public)

## 1. Supabase project

1. สร้าง project ที่ region **Southeast Asia (Singapore) — ap-southeast-1** (ต้องตรงกับ Vercel `sin1` · FDR-0004)
2. Authentication → Providers → เปิด **Google** (ใส่ OAuth client จาก Google Cloud) และ **Email** (magic link)
3. Authentication → URL Configuration → Site URL = URL ของแอป · Redirect URLs เพิ่ม `<site>/auth/confirm` และ `http://localhost:3000/auth/confirm`
4. คัดลอกค่าใส่ `.env` ตาม `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_KEY` (publishable key)
   - `NUXT_DATABASE_URL` = connection string แบบ **Transaction pooler** (port 6543)
   - `NUXT_SUPABASE_SECRET_KEY` = secret key (ใช้ได้ที่ `server/utils/privileged.ts` ที่เดียว — ADR-0005)
   - `NUXT_TRY_ON_WEBHOOK_SECRET`, `NUXT_CRON_SECRET` = สุ่มยาว ๆ เช่น `openssl rand -hex 32`
5. `npm run db:migrate`

## 2. Cron เก็บงานค้าง (pg_cron — ADR-0005)

Migration 0002 ตั้ง job `reconcile-try-ons` ไว้แล้ว แต่ต้องใส่ค่าลง Vault ก่อนมันจะเรียกได้
รันใน SQL Editor ของ Supabase (ค่าเป็นของจริง — อย่าบันทึกลงไฟล์ใน repo):

```sql
select vault.create_secret('https://<โดเมนของแอป>', 'app_site_url');
select vault.create_secret('<ค่าเดียวกับ NUXT_CRON_SECRET>', 'app_cron_secret');
```

ตรวจว่าทำงาน: `select * from cron.job_run_details order by start_time desc limit 5;`

## 3. Vercel

- ตั้ง env ทั้งหมดจาก `.env` + `NUXT_PUBLIC_SITE_URL`
- `vercel.json` ตั้ง region `sin1` แล้ว · ไม่ใช้ Vercel Cron (Hobby รันได้วันละครั้ง)
- `NUXT_TRY_ON_PROVIDER=mock` ใช้บน production ไม่ได้ (โค้ดกันไว้) — ต้องเลือก provider จริงก่อนเปิดใช้
