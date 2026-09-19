CREATE TYPE "public"."dislike_reason" AS ENUM('wrong_item', 'face', 'proportion', 'other');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('owned', 'wishlist');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('th', 'en');--> statement-breakpoint
CREATE TYPE "public"."pose_quality" AS ENUM('ok', 'warn');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."slot" AS ENUM('top', 'bottom', 'outer', 'dress', 'accessory');--> statement-breakpoint
CREATE TYPE "public"."try_on_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"global_daily_cap" integer NOT NULL,
	"new_user_quota" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "daily_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "daily_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "global_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "global_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_path" text NOT NULL,
	"original_path" text NOT NULL,
	"category" text NOT NULL,
	"slot" "slot" NOT NULL,
	"color" text,
	"status" "item_status" DEFAULT 'owned' NOT NULL,
	"shop_url" text,
	"name" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "look_dislikes" (
	"look_id" uuid PRIMARY KEY NOT NULL,
	"reason" "dislike_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "look_dislikes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "look_occasions" (
	"look_id" uuid NOT NULL,
	"occasion_id" uuid NOT NULL,
	CONSTRAINT "look_occasions_look_id_occasion_id_pk" PRIMARY KEY("look_id","occasion_id")
);
--> statement-breakpoint
ALTER TABLE "look_occasions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "looks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"try_on_id" uuid NOT NULL,
	"image_path" text NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "looks_try_on_id_unique" UNIQUE("try_on_id")
);
--> statement-breakpoint
ALTER TABLE "looks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "occasions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "occasions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "poses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"quality" "pose_quality" NOT NULL,
	"warnings" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"daily_quota" integer NOT NULL,
	"locale" "locale" DEFAULT 'th' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"look_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "try_on_items" (
	"try_on_id" uuid NOT NULL,
	"item_id" uuid,
	"slot" "slot" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "try_on_items_try_on_id_slot_position_pk" PRIMARY KEY("try_on_id","slot","position")
);
--> statement-breakpoint
ALTER TABLE "try_on_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "try_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pose_id" uuid,
	"remix_of_look_id" uuid,
	"status" "try_on_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"provider_job_id" text,
	"error_code" text,
	"quota_day" date NOT NULL,
	"quota_refunded" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "try_ons_provider_job_id_unique" UNIQUE("provider_job_id")
);
--> statement-breakpoint
ALTER TABLE "try_ons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "look_dislikes" ADD CONSTRAINT "look_dislikes_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "look_occasions" ADD CONSTRAINT "look_occasions_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "look_occasions" ADD CONSTRAINT "look_occasions_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "looks" ADD CONSTRAINT "looks_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "looks" ADD CONSTRAINT "looks_try_on_id_try_ons_id_fk" FOREIGN KEY ("try_on_id") REFERENCES "public"."try_ons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poses" ADD CONSTRAINT "poses_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "try_on_items" ADD CONSTRAINT "try_on_items_try_on_id_try_ons_id_fk" FOREIGN KEY ("try_on_id") REFERENCES "public"."try_ons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "try_on_items" ADD CONSTRAINT "try_on_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "try_ons" ADD CONSTRAINT "try_ons_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "try_ons" ADD CONSTRAINT "try_ons_pose_id_poses_id_fk" FOREIGN KEY ("pose_id") REFERENCES "public"."poses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "daily_usage_select_own" ON "daily_usage" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("daily_usage"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "items_select_own" ON "items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "items_insert_own" ON "items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "items_update_own" ON "items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("items"."user_id" = (select auth.uid())) WITH CHECK ("items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "items_delete_own" ON "items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "look_dislikes_select_own" ON "look_dislikes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.looks l where l.id = "look_dislikes"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "look_dislikes_insert_own" ON "look_dislikes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.looks l where l.id = "look_dislikes"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "look_dislikes_update_own" ON "look_dislikes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.looks l where l.id = "look_dislikes"."look_id" and l.user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.looks l where l.id = "look_dislikes"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "look_occasions_select_own" ON "look_occasions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.looks l where l.id = "look_occasions"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "look_occasions_insert_own" ON "look_occasions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.looks l where l.id = "look_occasions"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "look_occasions_delete_own" ON "look_occasions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.looks l where l.id = "look_occasions"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "looks_select_own" ON "looks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("looks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "looks_update_own" ON "looks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("looks"."user_id" = (select auth.uid())) WITH CHECK ("looks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "looks_delete_own" ON "looks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("looks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "occasions_select" ON "occasions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("occasions"."user_id" is null or "occasions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "occasions_insert_own" ON "occasions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("occasions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "occasions_update_own" ON "occasions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("occasions"."user_id" = (select auth.uid())) WITH CHECK ("occasions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "occasions_delete_own" ON "occasions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("occasions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "poses_select_own" ON "poses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("poses"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "poses_insert_own" ON "poses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("poses"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "poses_update_own" ON "poses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("poses"."user_id" = (select auth.uid())) WITH CHECK ("poses"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "poses_delete_own" ON "poses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("poses"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."user_id" = (select auth.uid())) WITH CHECK ("profiles"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "push_subscriptions_select_own" ON "push_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("push_subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "push_subscriptions_insert_own" ON "push_subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("push_subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "push_subscriptions_update_own" ON "push_subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("push_subscriptions"."user_id" = (select auth.uid())) WITH CHECK ("push_subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "push_subscriptions_delete_own" ON "push_subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("push_subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "share_links_select_own" ON "share_links" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.looks l where l.id = "share_links"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "share_links_insert_own" ON "share_links" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.looks l where l.id = "share_links"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "share_links_update_own" ON "share_links" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.looks l where l.id = "share_links"."look_id" and l.user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.looks l where l.id = "share_links"."look_id" and l.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "try_on_items_select_own" ON "try_on_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.try_ons o where o.id = "try_on_items"."try_on_id" and o.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "try_ons_select_own" ON "try_ons" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("try_ons"."user_id" = (select auth.uid()));