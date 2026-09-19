# HANDOFF

> **เขียนทับทั้งไฟล์ทุกครั้งที่ส่งมอบ** ไม่ต่อท้าย — ไฟล์นี้คือ "ไม้ที่กำลังส่ง" ไม่ใช่ประวัติ
> ส่งมอบเมื่อ: 2026-09-19

## ทำอะไรไปในเซสชันนี้
- ออกแบบทั้งโปรเจกต์จาก grill 31 ข้อ → CONTEXT.md · ADR-0001..0006 · drawio 9 หน้า (flow · wireframe · architecture · ER)
- ขึ้น GitHub public https://github.com/VoramethP/my-twin-styles (commit ใช้อีเมล noreply)
- ตั้งสแต็ก Nuxt 4 + Supabase + Drizzle · schema/RLS 14 ตาราง · โควต้า atomic · AI try-on แบบ mock ครบวงจร (สั่งลอง → webhook → cron retry/คืนโควต้า)
- หน้าจอ: S01 login · S04 onboarding · S02/S03 ถ่ายท่า + เช็กคุณภาพ

## สถานะ ณ ตอนส่ง
- **working tree:** สะอาด · push แล้ว
- **เทส:** `npm run check` ผ่าน (typecheck + unit 21) · `npm run test:db` ผ่าน 18 ข้อ (รันล่าสุดก่อน commit onboarding)
- **commit ล่าสุด:** `de5e779` feat(onboarding): หน้า S04 onboarding + S02/S03 ถ่ายท่าและเช็กคุณภาพ

## ค้างอยู่ตรงไหน
ไม่มีงานค้างกลางทาง — จบที่ onboarding ขั้น ① ครบ · ขั้น ② ③ ใน `app/pages/onboarding.vue` ยังเป็น `ready: false` ("เร็ว ๆ นี้")

## ทำต่อยังไง (ตามลำดับที่ผู้ใช้สั่ง)

### 1. ต่อ Supabase จริง — รอผู้ใช้ทำก่อน
- ผู้ใช้สร้าง project ตาม `docs/SETUP.md` §1 แล้วใส่ค่าใน `.env` (ห้าม commit — repo public)
- เมื่อผู้ใช้บอกว่าพร้อม: `npm run db:migrate` → ผู้ใช้ใส่ Vault ตาม §2 (ค่าจริงให้ผู้ใช้รันเองใน SQL Editor)
- ทดสอบจริง: `npm run dev` → login (Google + magic link) → onboarding → ถ่ายท่า อัปโหลด → เช็กว่ามีแถวใน `poses` และไฟล์อยู่ `poses/<user_id>/…`
- ถ้า `database.types.ts` ยังเตือน: ไม่ต้องสนใจ (Database = unknown) ยังไม่ได้ตัดสินว่าจะ gen type จากไหน

### 2. หน้าจอตู้เสื้อผ้า S08/S09 → เปิด onboarding ②
- ดู wireframe S08 · S08 ว่าง · S09 · S10 ในหน้า "6 Wireframes" และ flow หน้า "3 Flow: เพิ่มชิ้น"
- ทำตามแบบ pose: `shared/item.ts` (Zod + หมวด→ช่อง) · adapter ลบพื้นหลัง + เดาหมวด/สี (**mock** — provider ยังไม่เลือก)
  · อัปโหลดเข้า bucket `items/<user_id>/…` จากเบราว์เซอร์ · API บันทึกผ่าน `withUserDb`
- แล้วแก้ `onboarding.vue` ขั้น ② เป็น `ready: true` ชี้หน้าเพิ่มชิ้น
- เปิด skill `ui-decision` ก่อนเขียนหน้าจอ · ตรวจใน browser pane ที่ 375px (ดู "preview" ด้านล่าง)

### 3. S11 Outfit Builder → onboarding ③
- ใช้ `POST /api/try-ons` ที่มีอยู่แล้ว (`shared/outfit.ts` คือกติกาช่อง) · แสดงโควต้าคงเหลือบนปุ่ม
- ผลจาก mock เป็นรูป `public/mock/look-placeholder.svg`

## สิ่งที่ตกลงกันไว้แต่ยังไม่ได้เขียนลงไฟล์ไหน
- **ผู้ใช้ตอบ "ตามที่แนะนำ" แทบทุกข้อ** — ถ้าต้องตัดสินใจใหม่ ให้เสนอพร้อมคำแนะนำแบบ grilling (❓ Q + ➡️ แนะนำ) แล้วรอคำตอบ อย่าเลือกเองเงียบ ๆ
- **flow เพิ่มชิ้น (drawio หน้า 3) ที่ต้องทำตาม:** ลบพื้นหลังไม่สำเร็จ → ใช้รูปเดิม + เตือนว่าผลลองอาจเพี้ยน ·
  สถานะเริ่มต้น = มีแล้ว · ถ้าใส่ลิงก์ร้าน → แนะนำ "อยากได้" · มาจาก Builder → ใส่ชิ้นลงช่องที่กำลังเลือก ·
  หมวด→ช่อง: เสื้อ→top · กางเกง/กระโปรง→bottom · แจ็กเก็ต/คาร์ดิแกน→outer · เดรส/จั๊มสูท→dress · รองเท้า/กระเป๋า/เครื่องประดับ→accessory
- **provider AI ทุกตัว (try-on · ลบพื้นหลัง · เดาหมวด · เช็กท่า) เลือกทีหลัง** — ต้องเลือกก่อนเปิดใช้จริงและเขียน ADR · บัญชี/บิลควรเป็นของเพื่อน (คนจ่าย)
- **โปรเจกต์ทำให้เพื่อน** · ผู้ใช้จะให้ username ทีหลัง → เชิญสิทธิ์ admin (คำสั่งอยู่ใน HOTCACHE)
- ผู้ใช้ถูกแนะนำให้เปิด GitHub Settings → Emails → "Block command line pushes that expose my email" (ทำเองหรือยังไม่รู้)
- S02 ใช้กล้องของระบบแทนกล้องสดที่ซ้อนกรอบตาม wireframe — แจ้งผู้ใช้แล้ว ถ้าเขาอยากได้กล้องสดค่อยทำ
- ไอเดียที่ยังไม่ได้ทำ: cron ล้างไฟล์ใน `poses/` ที่ไม่มีแถวใน DB (ผู้ใช้ปิดหน้าตอนผลถูกบล็อก) ·
  หน้าโปรไฟล์ควรมีตัวเลือกธีม Light/Dark/Auto (ui-decision §1 — ตอนนี้ตามระบบ) · Web Push (VAPID)

## วิธีรันสิ่งที่ไม่ได้อยู่ใน repo
- **DB test** ต้องมี Postgres ที่ `127.0.0.1:55432` (cluster เดิมอยู่ใน scratchpad ของเซสชันนี้ — หายแล้ว) สร้างใหม่:
  ```bash
  export LC_ALL=C  # ไม่ใส่ postgres บน Mac ขึ้นไม่ได้
  initdb -D <dir> -U postgres --auth=trust -E UTF8 --locale=C
  printf "unix_socket_directories = ''\nlisten_addresses = '127.0.0.1'\nport = 55432\n" >> <dir>/postgresql.conf
  pg_ctl -D <dir> -l <dir>/log.txt start && npm run test:db
  ```
- **preview หน้าที่ต้องล็อกอินโดยไม่มี Supabase:** มี `/Users/tes/Documents/Project help/.claude/launch.json`
  ชื่อ `twin-preview-no-auth` (อยู่นอก repo) ใช้ `NUXT_PUBLIC_SUPABASE_REDIRECT_OPTIONS_EXCLUDE='["/*"]'` + ค่า Supabase ปลอม — API จะ 401 ซึ่งปกติ

## เกณฑ์ว่าไม้นี้ส่งได้จริง
เปิดแชตใหม่ อ่านไฟล์นี้ + `HOTCACHE.md` แล้วทำงานต่อได้ทันทีโดยไม่ต้องถามอะไรเลย
