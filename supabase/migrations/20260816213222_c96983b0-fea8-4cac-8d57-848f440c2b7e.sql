-- helper: resolve the owning doctor for a user inside a business
CREATE OR REPLACE FUNCTION public.rx_owner_doctor(_business_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.doctor_id FROM public.rx_staff s
      WHERE s.business_id = _business_id AND s.user_id = _user_id
      ORDER BY s.created_at DESC LIMIT 1),
    _user_id
  )
$$;

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.rx_chambers ADD COLUMN IF NOT EXISTS doctor_id uuid;

-- backfill
UPDATE public.prescriptions p
SET doctor_id = public.rx_owner_doctor(p.business_id, p.created_by)
WHERE p.doctor_id IS NULL AND p.created_by IS NOT NULL;

UPDATE public.rx_chambers c
SET doctor_id = public.rx_owner_doctor(c.business_id, c.created_by)
WHERE c.doctor_id IS NULL AND c.created_by IS NOT NULL;

UPDATE public.rx_appointments a
SET doctor_id = public.rx_owner_doctor(a.business_id, a.created_by)
WHERE a.doctor_id IS NULL AND a.created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS prescriptions_doctor_idx ON public.prescriptions(business_id, doctor_id);
CREATE INDEX IF NOT EXISTS rx_chambers_doctor_idx ON public.rx_chambers(business_id, doctor_id);
CREATE INDEX IF NOT EXISTS rx_appointments_doctor_idx ON public.rx_appointments(business_id, doctor_id);

-- auto-assign owner doctor on insert
CREATE OR REPLACE FUNCTION public.tg_rx_set_owner_doctor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.doctor_id IS NULL THEN
    NEW.doctor_id := public.rx_owner_doctor(NEW.business_id, COALESCE(NEW.created_by, auth.uid()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_owner_doctor ON public.prescriptions;
CREATE TRIGGER set_owner_doctor BEFORE INSERT ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_rx_set_owner_doctor();

DROP TRIGGER IF EXISTS set_owner_doctor ON public.rx_chambers;
CREATE TRIGGER set_owner_doctor BEFORE INSERT ON public.rx_chambers
FOR EACH ROW EXECUTE FUNCTION public.tg_rx_set_owner_doctor();

DROP TRIGGER IF EXISTS set_owner_doctor ON public.rx_appointments;
CREATE TRIGGER set_owner_doctor BEFORE INSERT ON public.rx_appointments
FOR EACH ROW EXECUTE FUNCTION public.tg_rx_set_owner_doctor();

-- RLS: scope to the owning doctor (admins keep full business access)
DROP POLICY IF EXISTS "Business members manage prescriptions" ON public.prescriptions;
CREATE POLICY "Doctor scoped prescriptions" ON public.prescriptions
FOR ALL TO authenticated
USING (
  is_business_member(auth.uid(), business_id)
  AND (
    is_business_admin(auth.uid(), business_id)
    OR doctor_id IS NULL
    OR doctor_id = public.rx_owner_doctor(business_id, auth.uid())
  )
)
WITH CHECK (
  is_business_member(auth.uid(), business_id)
  AND (
    is_business_admin(auth.uid(), business_id)
    OR doctor_id IS NULL
    OR doctor_id = public.rx_owner_doctor(business_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Members manage appointments" ON public.rx_appointments;
CREATE POLICY "Doctor scoped appointments" ON public.rx_appointments
FOR ALL TO authenticated
USING (
  is_business_member(auth.uid(), business_id)
  AND (
    is_business_admin(auth.uid(), business_id)
    OR doctor_id IS NULL
    OR doctor_id = public.rx_owner_doctor(business_id, auth.uid())
  )
)
WITH CHECK (
  is_business_member(auth.uid(), business_id)
  AND (
    is_business_admin(auth.uid(), business_id)
    OR doctor_id IS NULL
    OR doctor_id = public.rx_owner_doctor(business_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Members manage chambers" ON public.rx_chambers;
CREATE POLICY "Doctor scoped chambers" ON public.rx_chambers
FOR ALL TO authenticated
USING (
  is_business_member(auth.uid(), business_id)
  AND (
    is_business_admin(auth.uid(), business_id)
    OR doctor_id IS NULL
    OR doctor_id = public.rx_owner_doctor(business_id, auth.uid())
  )
)
WITH CHECK (
  is_business_member(auth.uid(), business_id)
  AND (
    is_business_admin(auth.uid(), business_id)
    OR doctor_id IS NULL
    OR doctor_id = public.rx_owner_doctor(business_id, auth.uid())
  )
);