CREATE TABLE public.rx_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  phone text,
  username text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, username)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_staff TO authenticated;
GRANT ALL ON public.rx_staff TO service_role;

ALTER TABLE public.rx_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors manage their own staff"
ON public.rx_staff FOR ALL TO authenticated
USING (
  public.is_business_member(auth.uid(), business_id)
  AND (doctor_id = auth.uid() OR user_id = auth.uid() OR public.is_business_admin(auth.uid(), business_id))
)
WITH CHECK (
  public.is_business_member(auth.uid(), business_id)
  AND (doctor_id = auth.uid() OR public.is_business_admin(auth.uid(), business_id))
);

CREATE TRIGGER rx_staff_set_updated_at
BEFORE UPDATE ON public.rx_staff
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.rx_appointments ADD COLUMN IF NOT EXISTS doctor_id uuid;