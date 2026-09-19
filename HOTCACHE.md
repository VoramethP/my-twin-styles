# 🔥 HOTCACHE

> อ่านไฟล์นี้หลัง `HANDOFF.md` · **ห้ามเกิน 500 คำ** (`wc -w`)
> เขียนทับในที่เดิมทุกครั้งที่ทำงานเสร็จเป็นชิ้น — ไม่ใช่ต่อท้าย
> Updated: **2026-09-19**

## โปรเจกต์นี้คืออะไร
Mobile-first PWA (UI ไทย) — ผู้ใช้สร้าง twin จากรูปเต็มตัว เอาชิ้นจากตู้เสื้อผ้า (มีแล้ว/อยากได้) มาจัดเป็นชุด
ให้ AI ลองบน twin ผลเป็นลุคใน lookbook ไว้ดูเป็น ref ตอนแต่งตัว หรือแชร์ถามเพื่อนผ่านลิงก์

## ตอนนี้อยู่ตรงไหน
- ผู้ใช้ทำโปรเจกต์นี้**ให้เพื่อน** — repo public: https://github.com/VoramethP/my-twin-styles (ยังไม่ได้เชิญเพื่อน)
- ✅ ออกแบบครบ: 25+ การตัดสินใจ · ADR-0001..0006 · drawio 9 หน้า
- ✅ **สแต็กตั้งแล้ว** (Nuxt 4.5 · Nuxt UI · Supabase · Drizzle 0.45 · Zod · Vitest) — typecheck + build ผ่าน
- ✅ schema + RLS 14 ตาราง · start_try_on/refund_quota · storage private · **ทดสอบบน Postgres จริงแล้ว** (`npm run test:db` 18 เทสต์)
- ✅ AI try-on: adapter + **mock** · API สั่งลอง · webhook · cron เก็บงานค้าง (retry 1 → คืนโควต้า)
- ✅ หน้าจอ: S01 login · S04 onboarding · S02/S03 ถ่ายท่า + เช็กคุณภาพ (ขนาด/ความมืดจริง · ข้อที่ต้องใช้ AI = mock)
- ❌ ยังไม่มี Supabase project จริง (ยังไม่เคยลองอัปโหลด/ล็อกอินจริง) · ยังไม่ deploy · ยังไม่มี Web Push

## กฎเหล็ก
1. ไม่มีทางใดที่คนอื่นเห็นรูปท่า (twin) · แอดมินไม่เห็นทั้งรูปท่าและรูปลุค — แชร์ได้แค่รูปลุคผ่านลิงก์เพิกถอนได้ (ADR-0003)
2. ทุกการลองผ่านโควต้ารายคน + เพดานรวม ก่อนเรียก AI — ผ่าน `start_try_on()` เท่านั้น (ADR-0002)
3. secret key ใช้ได้ที่ `server/utils/privileged` ที่เดียว — webhook/cron/push เท่านั้น (ADR-0005)
4. query ในนามผู้ใช้ผ่าน `withUserDb()` เท่านั้น — Drizzle owner ข้าม RLS (ADR-0006)

## งานถัดไป
1. ผู้ใช้สร้าง Supabase project ตาม `docs/SETUP.md` → `npm run db:migrate` + ใส่ Vault
2. หน้าจอต่อ: S08/S09 ตู้ (onboarding ② ยังเป็น "เร็ว ๆ นี้") → S11 Builder → S05/S06 ลุค → S13/S14 แชร์ (`server/api/share/` = ผู้เรียกที่ 4 ของโซนสิทธิ์พิเศษ)
3. เชิญเพื่อน: `gh api -X PUT repos/VoramethP/my-twin-styles/collaborators/<user> -f permission=admin`
4. เลือก AI provider (try-on + ลบพื้นหลัง + เช็กท่า) ก่อนเปิดใช้จริง → ADR · Web Push (VAPID)

## กับดักที่เคยเจอ
- repo **public** — commit ใช้อีเมล noreply ของ GitHub ห้ามเปลี่ยนกลับ
- ส่ง JSON เข้า SQL ให้ cast `::text::jsonb` — `::jsonb` ตรง ๆ postgres.js encode ซ้ำเป็น scalar
- TypeScript 7 ใช้กับ vue-tsc ไม่ได้ → pin `typescript@6`
- npm 11 บล็อก install script → หลัง `npm i` ครั้งแรกรัน `npx nuxt prepare` เอง (ต้องมี SUPABASE_URL/KEY แม้เป็นค่าปลอม)
- preview หน้าที่ต้องล็อกอินโดยไม่มี Supabase: `NUXT_PUBLIC_SUPABASE_REDIRECT_OPTIONS_EXCLUDE='["/*"]'` (ตั้ง `redirect` ผ่าน env ไม่ได้ — plugin ถูกใส่ตอน build)
- เปิด .drawio ใน draw.io แล้วบันทึก = จัด format ใหม่ทั้งไฟล์ — เทียบราย cell ก่อนสรุปว่าผู้ใช้แก้

---
📜 ประวัติเต็ม: `docs/WORKLOG.md` · 📐 กฎทั้งหมด: `CLAUDE.md` · 📖 คำศัพท์: `CONTEXT.md`
