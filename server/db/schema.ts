// Data model ตามหน้า "8 Data model" ใน docs/design/my-twin-styles.drawio
// RLS เปิดทุกตาราง (stack-setup) · ของที่ Drizzle เขียนไม่ได้ (function, trigger, column grant, storage)
// อยู่ใน migration แบบ custom: drizzle/*_functions_and_grants.sql
import { sql } from 'drizzle-orm'
import {
  boolean, date, integer, pgEnum, pgPolicy, pgTable, primaryKey, text, timestamp, uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase'

export const roleEnum = pgEnum('user_role', ['user', 'admin'])
export const localeEnum = pgEnum('locale', ['th', 'en'])
export const poseQualityEnum = pgEnum('pose_quality', ['ok', 'warn'])
// ช่องที่ render ลงตัว + accessory (ส่วนประกอบ ไม่ render) — ดู CONTEXT.md
export const slotEnum = pgEnum('slot', ['top', 'bottom', 'outer', 'dress', 'accessory'])
export const itemStatusEnum = pgEnum('item_status', ['owned', 'wishlist'])
export const tryOnStatusEnum = pgEnum('try_on_status', ['queued', 'running', 'succeeded', 'failed'])
export const dislikeReasonEnum = pgEnum('dislike_reason', ['wrong_item', 'face', 'proportion', 'other'])

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const isOwner = (userId: unknown) => sql`${userId} = ${authUid}`

// CRUD ทั้ง 4 ของเจ้าของ — ใช้กับตารางที่ผู้ใช้จัดการเองได้ทั้งหมด
function ownerCrud(table: string, userId: unknown) {
  return [
    pgPolicy(`${table}_select_own`, { for: 'select', to: authenticatedRole, using: isOwner(userId) }),
    pgPolicy(`${table}_insert_own`, { for: 'insert', to: authenticatedRole, withCheck: isOwner(userId) }),
    pgPolicy(`${table}_update_own`, { for: 'update', to: authenticatedRole, using: isOwner(userId), withCheck: isOwner(userId) }),
    pgPolicy(`${table}_delete_own`, { for: 'delete', to: authenticatedRole, using: isOwner(userId) }),
  ]
}

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  role: roleEnum('role').notNull().default('user'),
  dailyQuota: integer('daily_quota').notNull(),
  locale: localeEnum('locale').notNull().default('th'),
  createdAt: createdAt(),
}, t => [
  // สร้างโดย trigger ตอนสมัคร · แก้ได้แค่ display_name/locale (column grant) — role/daily_quota เป็นของแอดมิน
  pgPolicy('profiles_select_own', { for: 'select', to: authenticatedRole, using: isOwner(t.userId) }),
  pgPolicy('profiles_update_own', { for: 'update', to: authenticatedRole, using: isOwner(t.userId), withCheck: isOwner(t.userId) }),
]).enableRLS()

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: createdAt(),
}, t => ownerCrud('push_subscriptions', t.userId)).enableRLS()

export const poses = pgTable('poses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(), // bucket poses — private เสมอ (ADR-0003)
  quality: poseQualityEnum('quality').notNull(),
  warnings: text('warnings').array().notNull().default(sql`'{}'::text[]`),
  sortOrder: integer('sort_order').notNull(),
  createdAt: createdAt(),
}, t => ownerCrud('poses', t.userId)).enableRLS()

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  imagePath: text('image_path').notNull(), // ลบพื้นหลังแล้ว (หรือรูปเดิมถ้าลบไม่สำเร็จ)
  originalPath: text('original_path').notNull(),
  category: text('category').notNull(),
  slot: slotEnum('slot').notNull(),
  color: text('color'),
  status: itemStatusEnum('status').notNull().default('owned'),
  shopUrl: text('shop_url'),
  name: text('name'),
  note: text('note'),
  createdAt: createdAt(),
}, t => ownerCrud('items', t.userId)).enableRLS()

export const tryOns = pgTable('try_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  // ลบท่าแล้วลุคเดิมยังอยู่ (ADR-0003)
  poseId: uuid('pose_id').references(() => poses.id, { onDelete: 'set null' }),
  remixOfLookId: uuid('remix_of_look_id'),
  status: tryOnStatusEnum('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  provider: text('provider'),
  providerJobId: text('provider_job_id').unique(),
  errorCode: text('error_code'),
  quotaDay: date('quota_day').notNull(),
  quotaRefunded: boolean('quota_refunded').notNull().default(false),
  submittedAt: timestamp('submitted_at', { withTimezone: true }), // ส่งให้ provider ล่าสุดเมื่อไหร่ — cron ใช้จับ timeout
  createdAt: createdAt(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, t => [
  // สร้างได้ผ่าน start_try_on() เท่านั้น (จองโควต้า — ADR-0002) · เปลี่ยนสถานะได้แค่โซนสิทธิ์พิเศษ (ADR-0005)
  pgPolicy('try_ons_select_own', { for: 'select', to: authenticatedRole, using: isOwner(t.userId) }),
]).enableRLS()

export const tryOnItems = pgTable('try_on_items', {
  tryOnId: uuid('try_on_id').notNull().references(() => tryOns.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
  slot: slotEnum('slot').notNull(),
  position: integer('position').notNull().default(0),
}, t => [
  primaryKey({ columns: [t.tryOnId, t.slot, t.position] }),
  pgPolicy('try_on_items_select_own', {
    for: 'select', to: authenticatedRole,
    using: sql`exists (select 1 from public.try_ons o where o.id = ${t.tryOnId} and o.user_id = ${authUid})`,
  }),
]).enableRLS()

export const looks = pgTable('looks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  tryOnId: uuid('try_on_id').notNull().unique().references(() => tryOns.id, { onDelete: 'cascade' }),
  imagePath: text('image_path').notNull(),
  isFavorite: boolean('is_favorite').notNull().default(false),
  note: text('note'),
  createdAt: createdAt(),
}, t => [
  // สร้างโดย webhook เท่านั้น · ผู้ใช้แก้ได้แค่ is_favorite/note (column grant) และลบได้
  pgPolicy('looks_select_own', { for: 'select', to: authenticatedRole, using: isOwner(t.userId) }),
  pgPolicy('looks_update_own', { for: 'update', to: authenticatedRole, using: isOwner(t.userId), withCheck: isOwner(t.userId) }),
  pgPolicy('looks_delete_own', { for: 'delete', to: authenticatedRole, using: isOwner(t.userId) }),
]).enableRLS()

export const occasions = pgTable('occasions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.userId, { onDelete: 'cascade' }), // NULL = ค่าตั้งต้นของระบบ
  name: text('name').notNull(),
}, t => [
  pgPolicy('occasions_select', { for: 'select', to: authenticatedRole, using: sql`${t.userId} is null or ${t.userId} = ${authUid}` }),
  pgPolicy('occasions_insert_own', { for: 'insert', to: authenticatedRole, withCheck: isOwner(t.userId) }),
  pgPolicy('occasions_update_own', { for: 'update', to: authenticatedRole, using: isOwner(t.userId), withCheck: isOwner(t.userId) }),
  pgPolicy('occasions_delete_own', { for: 'delete', to: authenticatedRole, using: isOwner(t.userId) }),
]).enableRLS()

const ownsLook = (lookId: unknown) => sql`exists (select 1 from public.looks l where l.id = ${lookId} and l.user_id = ${authUid})`

export const lookOccasions = pgTable('look_occasions', {
  lookId: uuid('look_id').notNull().references(() => looks.id, { onDelete: 'cascade' }),
  occasionId: uuid('occasion_id').notNull().references(() => occasions.id, { onDelete: 'cascade' }),
}, t => [
  primaryKey({ columns: [t.lookId, t.occasionId] }),
  pgPolicy('look_occasions_select_own', { for: 'select', to: authenticatedRole, using: ownsLook(t.lookId) }),
  pgPolicy('look_occasions_insert_own', { for: 'insert', to: authenticatedRole, withCheck: ownsLook(t.lookId) }),
  pgPolicy('look_occasions_delete_own', { for: 'delete', to: authenticatedRole, using: ownsLook(t.lookId) }),
]).enableRLS()

export const lookDislikes = pgTable('look_dislikes', {
  lookId: uuid('look_id').primaryKey().references(() => looks.id, { onDelete: 'cascade' }),
  reason: dislikeReasonEnum('reason').notNull(), // ไม่มีรูป — แอดมินเห็นแค่ reason (ADR-0003)
  createdAt: createdAt(),
}, t => [
  pgPolicy('look_dislikes_select_own', { for: 'select', to: authenticatedRole, using: ownsLook(t.lookId) }),
  pgPolicy('look_dislikes_insert_own', { for: 'insert', to: authenticatedRole, withCheck: ownsLook(t.lookId) }),
  pgPolicy('look_dislikes_update_own', { for: 'update', to: authenticatedRole, using: ownsLook(t.lookId), withCheck: ownsLook(t.lookId) }),
]).enableRLS()

export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  lookId: uuid('look_id').notNull().references(() => looks.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // เก็บแค่ hash — ไม่เก็บ token ดิบ
  createdAt: createdAt(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  viewCount: integer('view_count').notNull().default(0),
}, t => [
  pgPolicy('share_links_select_own', { for: 'select', to: authenticatedRole, using: ownsLook(t.lookId) }),
  pgPolicy('share_links_insert_own', { for: 'insert', to: authenticatedRole, withCheck: ownsLook(t.lookId) }),
  pgPolicy('share_links_update_own', { for: 'update', to: authenticatedRole, using: ownsLook(t.lookId), withCheck: ownsLook(t.lookId) }),
]).enableRLS()

// โควต้า (ADR-0002) — เขียนได้ผ่าน start_try_on() / refund_quota() เท่านั้น
export const dailyUsage = pgTable('daily_usage', {
  userId: uuid('user_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  used: integer('used').notNull().default(0),
}, t => [
  primaryKey({ columns: [t.userId, t.day] }),
  pgPolicy('daily_usage_select_own', { for: 'select', to: authenticatedRole, using: isOwner(t.userId) }),
]).enableRLS()

export const globalUsage = pgTable('global_usage', {
  day: date('day').primaryKey(),
  used: integer('used').notNull().default(0),
}).enableRLS()

export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  globalDailyCap: integer('global_daily_cap').notNull(),
  newUserQuota: integer('new_user_quota').notNull(),
}).enableRLS()
