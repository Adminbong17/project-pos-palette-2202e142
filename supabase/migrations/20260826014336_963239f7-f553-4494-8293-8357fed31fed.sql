CREATE TABLE public.bkash_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true CHECK (id),
  environment text NOT NULL DEFAULT 'live',
  app_key text,
  app_secret text,
  username text,
  password text,
  rate_per_credit numeric NOT NULL DEFAULT 3,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bkash_settings TO service_role;
ALTER TABLE public.bkash_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.bkash_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;