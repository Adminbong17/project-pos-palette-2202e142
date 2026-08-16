ALTER TABLE public.rx_appointments
  ADD COLUMN IF NOT EXISTS patient_type text NOT NULL DEFAULT 'new';

UPDATE public.rx_appointments
   SET patient_type = CASE WHEN is_new_patient IS false THEN 'old' ELSE 'new' END
 WHERE patient_type = 'new';

CREATE OR REPLACE FUNCTION public.tg_rx_appointment_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _prev_code text;
  _base text;
  _phone text := NULLIF(btrim(COALESCE(NEW.patient_phone, '')), '');
  _doc uuid;
  _fee_new numeric;
  _fee_old numeric;
BEGIN
  IF NEW.patient_type IS NULL OR NEW.patient_type NOT IN ('new','old','medical') THEN
    NEW.patient_type := 'new';
  END IF;

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
      IF NEW.patient_type = 'new' THEN NEW.patient_type := 'old'; END IF;
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

  NEW.is_new_patient := (NEW.patient_type = 'new');

  IF NEW.fee_amount IS NULL THEN
    IF NEW.patient_type = 'medical' THEN
      NEW.fee_amount := 0;
    ELSIF NEW.chamber_id IS NOT NULL THEN
      SELECT c.fee_new, c.fee_old INTO _fee_new, _fee_old
        FROM public.rx_chambers c WHERE c.id = NEW.chamber_id;
      NEW.fee_amount := CASE WHEN NEW.patient_type = 'new' THEN _fee_new ELSE _fee_old END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;