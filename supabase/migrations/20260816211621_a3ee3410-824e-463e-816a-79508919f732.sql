-- ============ settings (private schema) ============
CREATE TABLE IF NOT EXISTS backups.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  app_base_url text NOT NULL DEFAULT 'https://project--cdc3f150-e35b-41a6-a2d8-a5245f1c42bd.lovable.app',
  cron_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  retention_days integer NOT NULL DEFAULT 30,
  vault_threshold_mb integer NOT NULL DEFAULT 300,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO backups.settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON backups.settings FROM anon, authenticated;

-- ============ backup run log ============
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_name text,
  scope text NOT NULL DEFAULT 'business',
  status text NOT NULL DEFAULT 'success',
  storage text NOT NULL DEFAULT 'db',
  size_bytes bigint NOT NULL DEFAULT 0,
  db_size_bytes bigint,
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb,
  vault_file_id text,
  share_token text,
  file_name text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS backup_runs_created_idx ON public.backup_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS backup_runs_biz_idx ON public.backup_runs (business_id, created_at DESC);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin reads backup runs" ON public.backup_runs;
CREATE POLICY "super admin reads backup runs" ON public.backup_runs
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- ============ snapshot ============
CREATE OR REPLACE FUNCTION public.backup_business_snapshot(_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  result jsonb := '{}'::jsonb;
  part jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admin can create backups';
  END IF;

  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'business_id'
      AND c.table_name <> 'backup_runs'
    ORDER BY 1
  LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE x.business_id = $1',
      r.table_name
    ) INTO part USING _business_id;
    result := result || jsonb_build_object(r.table_name, part);
  END LOOP;

  -- member profiles (no business_id column)
  SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO part
  FROM public.profiles p
  WHERE p.id IN (SELECT bu.user_id FROM public.business_users bu WHERE bu.business_id = _business_id);
  result := result || jsonb_build_object('profiles', part);

  SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO part
  FROM public.businesses b WHERE b.id = _business_id;
  result := result || jsonb_build_object('businesses', part);

  RETURN result;
END $$;

-- row counts per table + per creator, for the UI
CREATE OR REPLACE FUNCTION public.backup_snapshot_stats(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  counts jsonb := '{}'::jsonb;
  users jsonb := '{}'::jsonb;
  row jsonb;
  uid text;
  cur int;
BEGIN
  FOR k IN SELECT jsonb_object_keys(_payload) LOOP
    counts := counts || jsonb_build_object(k, jsonb_array_length(_payload->k));
    FOR row IN SELECT * FROM jsonb_array_elements(_payload->k) LOOP
      uid := COALESCE(row->>'created_by', row->>'user_id');
      IF uid IS NOT NULL THEN
        cur := COALESCE((users->>uid)::int, 0);
        users := users || jsonb_build_object(uid, cur + 1);
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('tables', counts, 'users', users);
END $$;

-- ============ restore ============
CREATE OR REPLACE FUNCTION public.backup_restore(_run_id uuid, _tables text[] DEFAULT NULL, _user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
  v_keys text[];
  v_pending text[];
  v_next text[];
  t text;
  cols text;
  updates text;
  rows_json jsonb;
  pass int := 0;
  restored jsonb := '{}'::jsonb;
  failed jsonb := '{}'::jsonb;
  n bigint;
  has_id boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admin can restore backups';
  END IF;

  SELECT payload INTO v_payload FROM public.backup_runs WHERE id = _run_id;
  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'This backup has no inline data (stored externally) — import it first';
  END IF;

  SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(v_payload) k;
  IF _tables IS NOT NULL THEN
    SELECT array_agg(k) INTO v_keys FROM unnest(v_keys) k WHERE k = ANY(_tables);
  END IF;
  v_pending := COALESCE(v_keys, ARRAY[]::text[]);

  WHILE array_length(v_pending, 1) > 0 AND pass < 6 LOOP
    pass := pass + 1;
    v_next := ARRAY[]::text[];
    FOREACH t IN ARRAY v_pending LOOP
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=t AND column_name='id'
      ) INTO has_id;
      IF NOT has_id THEN CONTINUE; END IF;

      rows_json := v_payload->t;
      IF _user_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name IN ('created_by','user_id')) THEN
          SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO rows_json
          FROM jsonb_array_elements(v_payload->t) e
          WHERE COALESCE(e->>'created_by', e->>'user_id') = _user_id::text;
        ELSE
          CONTINUE;
        END IF;
      END IF;
      IF rows_json IS NULL OR jsonb_array_length(rows_json) = 0 THEN CONTINUE; END IF;

      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
             string_agg(format('%1$I = EXCLUDED.%1$I', column_name), ', ' ORDER BY ordinal_position)
      INTO cols, updates
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name <> 'id'
        AND is_generated = 'NEVER';

      BEGIN
        EXECUTE format(
          'INSERT INTO public.%1$I SELECT * FROM jsonb_populate_recordset(NULL::public.%1$I, $1)
             ON CONFLICT (id) DO UPDATE SET %2$s',
          t, updates
        ) USING rows_json;
        GET DIAGNOSTICS n = ROW_COUNT;
        restored := restored || jsonb_build_object(t, n);
        failed := failed - t;
      EXCEPTION WHEN OTHERS THEN
        v_next := array_append(v_next, t);
        failed := failed || jsonb_build_object(t, SQLERRM);
      END;
    END LOOP;
    IF v_next = v_pending THEN
      EXIT;
    END IF;
    v_pending := v_next;
  END LOOP;

  RETURN jsonb_build_object('restored', restored, 'failed', failed, 'passes', pass);
END $$;

-- ============ retention purge ============
CREATE OR REPLACE FUNCTION public.backup_purge_expired()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days integer;
  v_removed jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT retention_days INTO v_days FROM backups.settings WHERE id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'vault_file_id', vault_file_id)), '[]'::jsonb)
  INTO v_removed
  FROM public.backup_runs
  WHERE created_at < now() - make_interval(days => COALESCE(v_days, 30));

  DELETE FROM public.backup_runs
  WHERE created_at < now() - make_interval(days => COALESCE(v_days, 30));

  RETURN v_removed;
END $$;

-- ============ nightly scheduler (best effort) ============
DO $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net unavailable: %', SQLERRM;
  END;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable: %', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    SELECT app_base_url, cron_secret INTO v_url, v_secret FROM backups.settings WHERE id;
    BEGIN
      PERFORM cron.unschedule('nightly-backup');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'nightly-backup',
      '58 17 * * *',
      format(
        $q$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb) $q$,
        v_url || '/api/public/cron/backup',
        json_build_object('Content-Type','application/json','x-backup-secret', v_secret)::text
      )
    );
  END IF;
END $$;