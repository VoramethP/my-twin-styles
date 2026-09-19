-- ตัวตั้งเวลา cron เก็บงานค้าง (ADR-0005 · Q30): pg_cron + pg_net เรียก GET /api/cron/try-ons ทุก 1 นาที
-- URL และ CRON_SECRET อ่านจาก Supabase Vault ตอนรัน — ไม่อยู่ใน migration (repo public)
-- ตั้งค่า vault ครั้งเดียวตาม docs/SETUP.md · ฐานที่ไม่มี pg_cron/pg_net (Postgres ในเครื่องสำหรับเทสต์) จะข้ามทั้งหมด
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE NOTICE 'ไม่มี pg_cron/pg_net — ข้ามการตั้ง cron';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  PERFORM cron.schedule('reconcile-try-ons', '* * * * *', $job$
    SELECT net.http_get(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_site_url') || '/api/cron/try-ons',
      headers := jsonb_build_object('Authorization',
        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_cron_secret')),
      timeout_milliseconds := 20000
    );
  $job$);
END
$do$;
