# CLAUDE.md

## 🤝 เปิดแชตใหม่: อ่าน 2 ไฟล์นี้ก่อนเสมอ ตามลำดับ

**ก่อนจะค้นไฟล์ ก่อนจะ grep ก่อนจะเปิดเอกสารใด ๆ:**

| ลำดับ | ไฟล์ | ตอบคำถามว่า |
|---|---|---|
| 1️⃣ | [`HANDOFF.md`](HANDOFF.md) | **เมื่อกี้ทำอะไรค้างอยู่ · ทำต่อยังไง** (ยังไม่มี = ไม่มีงานค้าง) |
| 2️⃣ | [`HOTCACHE.md`](HOTCACHE.md) | **โปรเจกต์อยู่ตรงไหน · กฎเหล็ก · กับดักที่เคยเจอ** |

สองไฟล์นี้ยาวรวมกันไม่ถึง 900 คำ **คำตอบส่วนใหญ่อยู่ในนั้นแล้ว**
ค่อยไปเปิดไฟล์อื่นเมื่อสองไฟล์นี้ตอบไม่ได้จริง ๆ ตามลำดับนี้:

| หา | เปิด |
|---|---|
| คำนี้ในโปรเจกต์แปลว่าอะไร (twin, ท่า, ชิ้น, ช่อง, ชุด, ลุค, Remix) | [`CONTEXT.md`](CONTEXT.md) |
| ขอบเขต MVP · navigation · รายการหน้าจอ | [`docs/design/README.md`](docs/design/README.md) |
| flow · wireframe · architecture · ER (draw.io 9 หน้า) | [`docs/design/my-twin-styles.drawio`](docs/design/my-twin-styles.drawio) |
| ประวัติว่าทำอะไรไปบ้าง ทำไมถึงตัดสินใจแบบนั้น | [`docs/WORKLOG.md`](docs/WORKLOG.md) |
| เหตุผลเบื้องหลังการตัดสินใจเชิงสถาปัตยกรรม | [`docs/adr/`](docs/adr/) |

### ระบบความจำ 4 ชั้น — แต่ละไฟล์มีหน้าที่ต่างกัน ห้ามเขียนซ้ำกัน

| ไฟล์ | เปรียบเหมือน | ขอบเขต | ความยาว |
|---|---|---|---|
| `HANDOFF.md` | **ไม้ที่ส่งต่อ** | เฉพาะงานที่ค้างอยู่ ณ ตอนส่งมอบ | สั้น เขียนทับทั้งไฟล์ทุกครั้ง |
| `HOTCACHE.md` | **ความจำระยะสั้น** | สถานะโปรเจกต์ · กฎเหล็ก · กับดัก | **ห้ามเกิน 500 คำ** |
| `docs/WORKLOG.md` | **ความจำระยะยาว** | ทุกอย่างที่เคยเกิดขึ้น + เหตุผล | ไม่จำกัด |
| `CONTEXT.md` | **พจนานุกรม** | **คำนี้ในโปรเจกต์นี้แปลว่าอะไร** เท่านั้น | สั้น ไม่มีรายละเอียด implement |

> ถ้าสิ่งที่จะเขียนลง `CONTEXT.md` ไม่ใช่ "นิยามของคำ" แปลว่ามันควรไปอยู่ไฟล์อื่น

### 🔄 ทำงานเสร็จเป็นชิ้น (commit แล้ว) → อัปเดต 2 ไฟล์

1. `HOTCACHE.md` — สถานะ, งานถัดไป, กับดักใหม่, **ห้ามเกิน 500 คำ**
   (เกินเมื่อไหร่ ให้ย้ายของเก่าลง WORKLOG แล้วสรุปให้สั้นลง)
2. `docs/WORKLOG.md` — รายละเอียดเต็ม ต่อท้าย**ก่อน**หัวข้อ "งานถัดไป" เสมอ

### 🚨 context ใกล้เต็ม → เสนอ handoff

อย่ารอให้ผู้ใช้สังเกต · ขั้นตอนเต็มอยู่ใน skill `handoff` (`/handoff`)

---

## 🔬 Skill ที่ใช้ในโปรเจกต์นี้ (ระดับผู้ใช้ `~/.claude/skills/`)

| พิมพ์ | ได้อะไร | เขียนไฟล์ไหม |
|---|---|---|
| `/grilling` · `/grill-me` | ซักไซ้จนตกผลึก ใช้ได้กับทุกเรื่อง | ❌ |
| `/grill-with-docs` | ซักไซ้ + บันทึกคำศัพท์ลง `CONTEXT.md` และการตัดสินใจลง `docs/adr/` | ✅ |
| `/domain-modeling` | ลับคำศัพท์ · เขียน CONTEXT.md / ADR | ✅ |
| `/drawio-from-code` | สร้าง/เพิ่มหน้า .drawio · อ่านหน้า raw ของผู้ใช้ | ✅ |
| `/ui-decision` | เช็กลิสต์ตัดสินใจ UI ตอนทำหน้าจอจริง | ❌ |
| `/stack-setup` | กติกาสแต็ก Nuxt 4 + Supabase + Drizzle (ตั้งแล้ว — เปิดเมื่อแตะ auth/DB/deploy) | ✅ |
| `/context-checker` · `/handoff` | เช็ก context · ปิดเซสชันให้เซสชันหน้าทำต่อได้ | ✅ |

---

## โปรเจกต์นี้คืออะไร

Web app (mobile-first PWA, UI ไทย) ให้ผู้ใช้สร้าง **twin** จากรูปเต็มตัวของตัวเอง
นำเข้าเสื้อผ้าที่มีแล้วและที่อยากได้ลง **ตู้เสื้อผ้า** เลือกเป็น **ชุด** แล้วให้ AI ลองชุดบน twin
ผลที่ได้คือ **ลุค** เก็บใน **lookbook** ไว้เปิดดูเป็น ref ตอนแต่งตัว หรือแชร์ถามเพื่อนผ่านลิงก์

**แนวคิดที่ห้ามปนกัน:**

| คำ | คือ | ไม่ใช่ |
|---|---|---|
| **ชุด (Outfit)** | ชิ้นที่เลือก + ท่า — คำสั่งก่อน generate | ผลลัพธ์ |
| **ลุค (Look)** | ผลลัพธ์ที่สำเร็จแล้ว + ชุดที่ใช้ | คำสั่ง |
| **ช่อง (Slot)** | เสื้อ · ท่อนล่าง · ชั้นนอก · เดรส — render ลงตัว | รองเท้า/กระเป๋า |
| **ส่วนประกอบ** | รองเท้า · กระเป๋า · เครื่องประดับ — แนบดูคู่ | ไม่ render |

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev              # dev server (ต้องมี .env — ดู .env.example)
npm run check            # typecheck + unit test (ใช้ก่อน commit / handoff)
npm run test:db          # DB test บน Postgres ในเครื่อง (ฐานชั่วคราว → จำลอง Supabase → migrate → vitest)
npm run db:generate      # สร้าง migration จาก server/db/schema.ts
npm run db:migrate       # apply migration (NUXT_DATABASE_URL) — ห้าม drizzle-kit push
# export หน้า N ของไฟล์ออกแบบเป็น PNG (draw.io v27+ นับหน้าจาก 1)
"/Applications/draw.io.app/Contents/MacOS/draw.io" -x -f png -p 1 -s 1.5 -b 20 -o /tmp/page-1.png docs/design/my-twin-styles.drawio
```

`test:db` ต้องมี Postgres ฟังอยู่ที่ `TEST_PG_URL` (ค่าตั้งต้น `postgresql://postgres@127.0.0.1:55432`) ·
บน Mac ให้ `export LC_ALL=C` ก่อนเปิด postgres ไม่งั้นขึ้นไม่ได้

---

## กฎเหล็ก (ละเมิดไม่ได้)

1. **ไม่มีทางใดที่คนอื่นเห็นรูปท่า (twin) ได้ และแอดมินไม่เห็นทั้งรูปท่าและรูปลุค** — รูปลุคเห็นได้แค่เจ้าของ + ลิงก์แชร์ที่เพิกถอนได้ · ลบแล้วต้องลบไฟล์จริง
   ([ADR-0003](docs/adr/ADR-0003-twin-photos-never-shared.md)) · ❌ ใส่ URL รูปท่าในหน้าแชร์ หรือเปิด bucket แบบ public
2. **ทุกการลองต้องผ่านโควต้ารายคน + เพดานรวม ก่อนเรียก AI** — จองแบบ atomic ตอนสั่ง คืนเฉพาะเมื่อระบบล้มเหลว
   ([ADR-0002](docs/adr/ADR-0002-open-signup-with-quota-and-global-cap.md)) · ❌ เรียก AI ตรงจาก endpoint ไหนก็ได้โดยไม่ผ่านตัวเช็ก
3. **secret key ของ Supabase ใช้ได้ที่ `server/utils/privileged` ที่เดียว** — เรียกได้จาก webhook (ตรวจลายเซ็น) · cron (ตรวจ CRON_SECRET) · push เท่านั้น
   ([ADR-0005](docs/adr/ADR-0005-privileged-zone-for-background-work.md)) · ❌ import โมดูลนี้จาก route ที่มี session ผู้ใช้ หรือเชื่อ user_id จาก payload ภายนอก
4. **query ในนามผู้ใช้ผ่าน `withUserDb()` เท่านั้น** — Drizzle ต่อด้วย owner ซึ่งข้าม RLS
   ([ADR-0006](docs/adr/ADR-0006-drizzle-queries-through-with-user-db.md)) · ❌ เรียก `openDb()` ตรงจาก route ของผู้ใช้

---

## โครงสร้าง

```
app/                       หน้าจอ (Nuxt UI) — ตอนนี้มี login + หน้าแรกชั่วคราว
server/api/try-ons.post.ts สั่งลอง: จองโควต้า → ส่งให้ provider (session ผู้ใช้)
server/api/webhooks/·cron/ โซนสิทธิ์พิเศษ (ADR-0005)
server/db/schema.ts        Drizzle schema + RLS policy
server/utils/db.ts         openDb · withUserDb (ADR-0006)
server/utils/privileged.ts ที่เดียวที่อ่าน secret key ได้
server/utils/try-on/       adapter interface · mock · lifecycle (retry/คืนโควต้า)
shared/outfit.ts           Zod: กติกาช่องของชุด
drizzle/                   migration (0001 = function/grant/storage เขียนมือ)
tests/                     unit · tests/db = RLS + lifecycle บน Postgres จริง
CLAUDE.md · HOTCACHE.md · CONTEXT.md · docs/   ความจำ + ออกแบบ + ADR
```

## ธรรมเนียมการเขียน

- **ภาษาไทย** สำหรับ commit message, คอมเมนต์อธิบาย "ทำไม", และการสนทนา
- ชื่อตัวแปร/ฟังก์ชันเป็นอังกฤษ ใช้คำจาก `CONTEXT.md` (twin, pose, item, slot, outfit, look, remix)
- คอมเมนต์อธิบาย **ทำไม** ไม่ใช่ **อะไร**
- commit format: `feat(scope):` / `fix(scope):` / `docs(scope):` + คำอธิบายไทย
- ต่อท้าย commit ด้วย `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- ไฟล์ .drawio: **ห้าม regenerate ทับ** หลังผู้ใช้แก้แล้ว — เพิ่มหน้าด้วยการแทรก `<diagram>` · อ่านหน้า raw ด้วยการ export PNG

## ความปลอดภัย

- key ของ AI provider / Supabase อยู่ใน `.env` เท่านั้น ห้าม commit (ดู skill `repo-hygiene` ก่อน push ครั้งแรก)
- ห้าม log URL รูปท่าแบบ signed หรือ token ของลิงก์แชร์
