-- ของที่ Drizzle schema เขียนไม่ได้: FK วน · ค่าเริ่มต้น · column grant · function · trigger · storage
-- ทุก function เป็น SECURITY DEFINER + search_path = '' (stack-setup) และอ้างชื่อเต็มทุกตัว

-- ── ค่าตั้งต้น ────────────────────────────────────────────────
INSERT INTO public.app_settings (id, global_daily_cap, new_user_quota) VALUES (1, 500, 5)
  ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_single_row CHECK (id = 1);--> statement-breakpoint
INSERT INTO public.occasions (user_id, name) VALUES
  (NULL, 'ทำงาน'), (NULL, 'เที่ยว'), (NULL, 'ออกงาน'), (NULL, 'สบาย ๆ');--> statement-breakpoint

-- Remix อ้างถึงลุคต้นทาง (FK วนระหว่าง try_ons ↔ looks จึงใส่ทีหลัง)
ALTER TABLE public.try_ons ADD CONSTRAINT try_ons_remix_of_look_id_fk
  FOREIGN KEY (remix_of_look_id) REFERENCES public.looks(id) ON DELETE SET NULL;--> statement-breakpoint

-- ── column grant: แก้ได้เฉพาะคอลัมน์ที่เป็นของผู้ใช้ ──────────────
REVOKE UPDATE ON public.profiles FROM authenticated, anon;--> statement-breakpoint
GRANT UPDATE (display_name, locale) ON public.profiles TO authenticated;--> statement-breakpoint
REVOKE UPDATE ON public.looks FROM authenticated, anon;--> statement-breakpoint
GRANT UPDATE (is_favorite, note) ON public.looks TO authenticated;--> statement-breakpoint
REVOKE UPDATE ON public.share_links FROM authenticated, anon;--> statement-breakpoint
GRANT UPDATE (revoked_at) ON public.share_links TO authenticated;--> statement-breakpoint

-- ── สมัครใหม่ → profile พร้อมโควต้าตั้งต้น ──────────────────────
CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, daily_quota)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name',
          (SELECT s.new_user_quota FROM public.app_settings s WHERE s.id = 1));
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

-- ── twin มีได้ไม่เกิน 5 ท่า ─────────────────────────────────────
CREATE FUNCTION public.enforce_pose_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT count(*) FROM public.poses p WHERE p.user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'pose_limit_reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER poses_limit BEFORE INSERT ON public.poses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pose_limit();--> statement-breakpoint

-- ── start_try_on: จองโควต้ารายคน + เพดานรวม แบบ atomic แล้วสร้างการลอง (ADR-0002) ──
-- p_items = [{"slot":"top","item_id":"…"}, …] — ตรวจรูปแบบชุดด้วย Zod ที่ API ก่อนแล้ว ที่นี่ตรวจความเป็นเจ้าของ
CREATE FUNCTION public.start_try_on(p_pose_id uuid, p_items jsonb, p_remix_of uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_day date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_quota int;
  v_cap int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.poses p WHERE p.id = p_pose_id AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'pose_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
    WHERE NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = (e ->> 'item_id')::uuid AND i.user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_remix_of IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.looks l WHERE l.id = p_remix_of AND l.user_id = v_uid) THEN
    RAISE EXCEPTION 'look_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT pr.daily_quota INTO v_quota FROM public.profiles pr WHERE pr.user_id = v_uid;
  SELECT s.global_daily_cap INTO v_cap FROM public.app_settings s WHERE s.id = 1;

  INSERT INTO public.daily_usage (user_id, day, used) VALUES (v_uid, v_day, 0) ON CONFLICT DO NOTHING;
  UPDATE public.daily_usage SET used = used + 1 WHERE user_id = v_uid AND day = v_day AND used < v_quota;
  IF NOT FOUND THEN RAISE EXCEPTION 'quota_exceeded' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.global_usage (day, used) VALUES (v_day, 0) ON CONFLICT DO NOTHING;
  UPDATE public.global_usage SET used = used + 1 WHERE day = v_day AND used < v_cap;
  -- ไม่ผ่านตรงนี้ exception จะ rollback การจองรายคนข้างบนด้วย
  IF NOT FOUND THEN RAISE EXCEPTION 'global_cap_reached' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.try_ons (user_id, pose_id, remix_of_look_id, quota_day)
  VALUES (v_uid, p_pose_id, p_remix_of, v_day) RETURNING id INTO v_id;

  INSERT INTO public.try_on_items (try_on_id, item_id, slot, position)
  SELECT v_id, (e ->> 'item_id')::uuid, (e ->> 'slot')::public.slot,
         (row_number() OVER (PARTITION BY e ->> 'slot' ORDER BY ord) - 1)::int
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, ord);

  RETURN v_id;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.start_try_on(uuid, jsonb, uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.start_try_on(uuid, jsonb, uuid) TO authenticated;--> statement-breakpoint

-- ── refund_quota: คืนโควต้าเมื่อระบบล้มเหลวเท่านั้น (👎 ไม่คืน) · เรียกจากโซนสิทธิ์พิเศษ (ADR-0005) ──
CREATE FUNCTION public.refund_quota(p_try_on_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_day date;
BEGIN
  UPDATE public.try_ons SET quota_refunded = true
  WHERE id = p_try_on_id AND status = 'failed' AND NOT quota_refunded
  RETURNING user_id, quota_day INTO v_uid, v_day;
  IF NOT FOUND THEN RETURN false; END IF; -- คืนซ้ำไม่ได้ (webhook/cron อาจยิงซ้ำ)
  UPDATE public.daily_usage SET used = greatest(used - 1, 0) WHERE user_id = v_uid AND day = v_day;
  UPDATE public.global_usage SET used = greatest(used - 1, 0) WHERE day = v_day;
  RETURN true;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.refund_quota(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- ── admin_stats: ตัวเลขเท่านั้น ไม่มี path รูปใด ๆ (ADR-0003) ──────────
CREATE FUNCTION public.admin_stats() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'try_ons_today', coalesce((SELECT g.used FROM public.global_usage g WHERE g.day = v_day), 0),
    'global_daily_cap', (SELECT s.global_daily_cap FROM public.app_settings s WHERE s.id = 1),
    'new_users_today', (SELECT count(*) FROM public.profiles p WHERE (p.created_at AT TIME ZONE 'Asia/Bangkok')::date = v_day),
    'failed_today', (SELECT count(*) FROM public.try_ons t WHERE t.quota_day = v_day AND t.status = 'failed'),
    'dislikes_today', (SELECT count(*) FROM public.look_dislikes d WHERE (d.created_at AT TIME ZONE 'Asia/Bangkok')::date = v_day),
    'dislike_reasons_7d', (
      SELECT coalesce(jsonb_object_agg(r.reason, r.n), '{}'::jsonb) FROM (
        SELECT d.reason, count(*) AS n FROM public.look_dislikes d
        WHERE d.created_at > now() - interval '7 days' GROUP BY d.reason) r)
  );
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;--> statement-breakpoint

-- trigger function ไม่ควรถูกเรียกตรงผ่าน API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.enforce_pose_limit() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- ── Storage: private ทั้งหมด · path = <user_id>/<file> (ADR-0003) ─────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('poses', 'poses', false), ('items', 'items', false), ('looks', 'looks', false)
  ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
CREATE POLICY "poses_items_rw_own_folder" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('poses', 'items') AND (storage.foldername(name))[1] = (select auth.uid())::text)
  WITH CHECK (bucket_id IN ('poses', 'items') AND (storage.foldername(name))[1] = (select auth.uid())::text);--> statement-breakpoint
-- รูปลุคเขียนโดย webhook เท่านั้น — เจ้าของอ่านและลบได้
CREATE POLICY "looks_read_own_folder" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'looks' AND (storage.foldername(name))[1] = (select auth.uid())::text);--> statement-breakpoint
CREATE POLICY "looks_delete_own_folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'looks' AND (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint

-- ── mark_try_on_submitted: route ของผู้ใช้บันทึกว่าส่งงานให้ provider แล้ว (ผู้ใช้ update try_ons ตรงไม่ได้) ──
CREATE FUNCTION public.mark_try_on_submitted(p_try_on_id uuid, p_provider text, p_job_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.try_ons
  SET status = 'running', provider = p_provider, provider_job_id = p_job_id,
      attempts = attempts + 1, submitted_at = now()
  WHERE id = p_try_on_id AND user_id = auth.uid() AND status = 'queued' AND attempts = 0;
  RETURN FOUND;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.mark_try_on_submitted(uuid, text, text) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.mark_try_on_submitted(uuid, text, text) TO authenticated;
