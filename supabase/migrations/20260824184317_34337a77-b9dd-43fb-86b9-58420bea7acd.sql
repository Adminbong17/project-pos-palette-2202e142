CREATE TABLE public.sms_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true CHECK (id),
  provider text NOT NULL DEFAULT 'revesms',
  base_url text NOT NULL DEFAULT 'http://smpp.revesms.com:7788',
  api_key text,
  secret_key text,
  caller_id text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sms_settings TO service_role;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sms_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;