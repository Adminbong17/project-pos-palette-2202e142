ALTER TABLE public.bkash_settings
  ADD COLUMN IF NOT EXISTS cached_id_token text,
  ADD COLUMN IF NOT EXISTS cached_refresh_token text,
  ADD COLUMN IF NOT EXISTS cached_token_expires_at timestamptz;