ALTER TABLE public.rx_chambers
  ADD COLUMN IF NOT EXISTS fee_new numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_old numeric NOT NULL DEFAULT 0;

ALTER TABLE public.rx_appointments
  ADD COLUMN IF NOT EXISTS patient_code text,
  ADD COLUMN IF NOT EXISTS is_new_patient boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fee_amount numeric,
  ADD COLUMN IF NOT EXISTS doctor_id uuid;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS patient_code text;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS clinic_mode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS rx_appointments_patient_code_idx ON public.rx_appointments (business_id, patient_code);
CREATE INDEX IF NOT EXISTS prescriptions_patient_code_idx ON public.prescriptions (business_id, patient_code);

CREATE OR REPLACE FUNCTION public.tg_rx_appointment_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev_code text;
  _base text;
  _phone text := NULLIF(btrim(COALESCE(NEW.patient_phone, '')), '');
  _doc uuid;
  _fee_new numeric;
  _fee_old numeric;
BEGIN
  -- Which doctor does this queue entry belong to? Assistants create entries
  -- for the doctor who hired them.
  IF NEW.doctor_id IS NULL THEN
    SELECT s.doctor_id INTO _doc
      FROM public.rx_staff s
     WHERE s.user_id = COALESCE(NEW.created_by, auth.uid())
       AND s.business_id = NEW.business_id
     LIMIT 1;
    NEW.doctor_id := COALESCE(_doc, NEW.created_by, auth.uid());
  END IF;

  -- Returning patient (same phone) keeps their original patient id.
  IF NEW.patient_code IS NULL AND _phone IS NOT NULL THEN
    SELECT a.patient_code INTO _prev_code
      FROM public.rx_appointments a
     WHERE a.business_id = NEW.business_id
       AND btrim(COALESCE(a.patient_phone, '')) = _phone
       AND a.patient_code IS NOT NULL
     ORDER BY a.created_at DESC
     LIMIT 1;
    IF _prev_code IS NOT NULL THEN
      NEW.patient_code := _prev_code;
      NEW.is_new_patient := false;
    END IF;
  END IF;

  IF NEW.patient_code IS NULL THEN
    _base := upper(regexp_replace(COALESCE(NEW.patient_name, ''), '[^A-Za-z]', '', 'g'));
    _base := COALESCE(NULLIF(substring(_base from 1 for 3), ''), 'PAT');
    WHILE length(_base) < 3 LOOP
      _base := _base || 'X';
    END LOOP;
    NEW.patient_code := _base || lpad((floor(random() * 1000000))::int::text, 6, '0');
  END IF;

  IF NEW.fee_amount IS NULL AND NEW.chamber_id IS NOT NULL THEN
    SELECT c.fee_new, c.fee_old INTO _fee_new, _fee_old
      FROM public.rx_chambers c WHERE c.id = NEW.chamber_id;
    NEW.fee_amount := CASE WHEN NEW.is_new_patient THEN _fee_new ELSE _fee_old END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rx_appointment_defaults ON public.rx_appointments;
CREATE TRIGGER trg_rx_appointment_defaults
  BEFORE INSERT ON public.rx_appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_rx_appointment_defaults();