CREATE TABLE public.patient_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.patient_login_codes TO service_role;
ALTER TABLE public.patient_login_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX patient_login_codes_phone_idx ON public.patient_login_codes (phone, created_at DESC);