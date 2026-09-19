# ADR-0006 — query ในนามผู้ใช้ต้องผ่าน withUserDb() · ฐานเดียว ไม่มี workspace

**สถานะ:** ✅ Accepted · 2026-09-19

## บริบท

สแต็กมาตรฐานใช้ Drizzle ต่อ Postgres ตรง ซึ่ง connection เป็น role เจ้าของตาราง — **ข้าม RLS ทั้งหมด**
RLS ที่เขียนไว้ใน schema จึงไม่มีผลเลย ถ้า route ของผู้ใช้ query ด้วย connection นั้นตรง ๆ

อีกเรื่อง: สแต็กกำหนด `getDb(workspaceId)` เพื่อรองรับฐานต่อ workspace ของ platform
แต่แอปนี้เป็นแอปเดียว ผู้ใช้ทุกคนอยู่ฐานเดียว ไม่มีแนวคิด workspace

## ทางเลือกที่พิจารณา

| ทางเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| ใช้ supabase-js (PostgREST) ในนามผู้ใช้แทน Drizzle | RLS ทำงานเอง | ออกนอกสแต็ก · เสีย type/query builder ของ Drizzle |
| Drizzle ตรง แล้วเช็กสิทธิ์ในโค้ดเอง | ง่าย | RLS กลายเป็นของประดับ ลืมเช็กจุดเดียว = ข้อมูลรั่ว |
| **Drizzle ใน transaction ที่ `set local role authenticated` + ตั้ง `request.jwt.claims`** ✔︎ | RLS ทำงานจริง · ใช้ Drizzle ได้ครบ | ทุก request เปิด transaction · ลืมใช้ helper = ข้าม RLS |

## การตัดสินใจ

- route ที่มี session ผู้ใช้ query ผ่าน `withUserDb(event, fn)` ใน `server/utils/db.ts` เท่านั้น
  (ตรวจ `getUser()` → เปิด transaction → set claims + role → เรียก fn)
- connection ที่ข้าม RLS (`openDb` ตรง ๆ) ใช้ได้เฉพาะในโซนสิทธิ์พิเศษผ่าน `openPrivilegedDb` (ADR-0005)
- ไม่ใช้ `getDb(workspaceId)` — ฐานเดียว เปิด connection ต่อ request ด้วย `openDb(event)` (ไม่มี db ระดับ module)

## ผลที่ตามมา

- DB test ต้องรันในฐานะ `authenticated` (`tests/db/helpers.ts › asUser`) — owner ข้าม RLS จะเทสต์ไม่ได้อะไร
- ส่งค่า JSON เข้า SQL ให้ cast `::text::jsonb` — cast `::jsonb` ตรง ๆ driver จะ encode ซ้ำจนเป็น scalar (เจอใน DB test)

## ทบทวนเมื่อไหร่

เมื่อแอปต้องรองรับหลายองค์กร/ฐาน หรือเมื่อ Drizzle มีวิธีผูก RLS กับ request ที่เป็นทางการ
