CREATE OR REPLACE FUNCTION public.backup_db_size()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT pg_database_size(current_database()); $$;

CREATE OR REPLACE FUNCTION public.backup_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jsonb_build_object(
    'app_base_url', s.app_base_url,
    'cron_secret', s.cron_secret,
    'retention_days', s.retention_days,
    'vault_threshold_mb', s.vault_threshold_mb,
    'cron_enabled', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  ) INTO v FROM backups.settings s WHERE s.id;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.backup_settings_update(
  _app_base_url text DEFAULT NULL,
  _retention_days integer DEFAULT NULL,
  _vault_threshold_mb integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE backups.settings SET
    app_base_url = COALESCE(NULLIF(_app_base_url, ''), app_base_url),
    retention_days = COALESCE(_retention_days, retention_days),
    vault_threshold_mb = COALESCE(_vault_threshold_mb, vault_threshold_mb),
    updated_at = now()
  WHERE id
  RETURNING app_base_url, cron_secret INTO v_url, v_secret;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('nightly-backup');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('nightly-backup', '58 17 * * *',
      format($q$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb)$q$,
        v_url || '/api/public/cron/backup',
        json_build_object('Content-Type','application/json','x-backup-secret', v_secret)::text));
  END IF;

  RETURN public.backup_settings();
END $$;

REVOKE EXECUTE ON FUNCTION public.backup_db_size() FROM anon;
REVOKE EXECUTE ON FUNCTION public.backup_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.backup_settings_update(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backup_business_snapshot(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backup_snapshot_stats(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backup_restore(uuid, text[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backup_purge_expired() FROM anon;