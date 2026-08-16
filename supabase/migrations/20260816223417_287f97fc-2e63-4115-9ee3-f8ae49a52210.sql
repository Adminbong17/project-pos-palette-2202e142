-- 1. Prescriptions: patient type + fee + auto patient id
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS patient_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS fee_amount numeric;

CREATE OR REPLACE FUNCTION public.tg_prescription_patient_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prev text;
  _base text;
  _phone text := NULLIF(btrim(COALESCE(NEW.patient_phone, '')), '');
BEGIN
  IF NEW.patient_type IS NULL OR NEW.patient_type NOT IN ('new','old','medical') THEN
    NEW.patient_type := 'new';
  END IF;

  NEW.patient_code := NULLIF(btrim(COALESCE(NEW.patient_code, '')), '');

  IF NEW.patient_code IS NULL AND _phone IS NOT NULL THEN
    SELECT a.patient_code INTO _prev
      FROM public.rx_appointments a
     WHERE a.business_id = NEW.business_id
       AND btrim(COALESCE(a.patient_phone, '')) = _phone
       AND a.patient_code IS NOT NULL
     ORDER BY a.created_at DESC LIMIT 1;
    IF _prev IS NULL THEN
      SELECT p.patient_code INTO _prev
        FROM public.prescriptions p
       WHERE p.business_id = NEW.business_id
         AND btrim(COALESCE(p.patient_phone, '')) = _phone
         AND p.patient_code IS NOT NULL
       ORDER BY p.created_at DESC LIMIT 1;
    END IF;
    IF _prev IS NOT NULL THEN
      NEW.patient_code := _prev;
      IF NEW.patient_type = 'new' THEN NEW.patient_type := 'old'; END IF;
    END IF;
  END IF;

  IF NEW.patient_code IS NULL THEN
    _base := upper(regexp_replace(COALESCE(NEW.patient_name, ''), '[^A-Za-z]', '', 'g'));
    _base := COALESCE(NULLIF(substring(_base from 1 for 3), ''), 'PAT');
    WHILE length(_base) < 3 LOOP _base := _base || 'X'; END LOOP;
    NEW.patient_code := _base || lpad((floor(random() * 1000000))::int::text, 6, '0');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_prescription_patient_defaults ON public.prescriptions;
CREATE TRIGGER tg_prescription_patient_defaults
BEFORE INSERT OR UPDATE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_prescription_patient_defaults();

UPDATE public.prescriptions SET patient_code = NULL WHERE btrim(COALESCE(patient_code,'')) = '';

-- 2. Medical-person fee per location
ALTER TABLE public.rx_chambers
  ADD COLUMN IF NOT EXISTS fee_medical numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_rx_appointment_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prev_code text;
  _base text;
  _phone text := NULLIF(btrim(COALESCE(NEW.patient_phone, '')), '');
  _doc uuid;
  _fee_new numeric;
  _fee_old numeric;
  _fee_med numeric;
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

  IF NEW.patient_code IS NULL AND _phone IS NOT NULL THEN
    SELECT a.patient_code INTO _prev_code
      FROM public.rx_appointments a
     WHERE a.business_id = NEW.business_id
       AND btrim(COALESCE(a.patient_phone, '')) = _phone
       AND a.patient_code IS NOT NULL
     ORDER BY a.created_at DESC LIMIT 1;
    IF _prev_code IS NOT NULL THEN
      NEW.patient_code := _prev_code;
      IF NEW.patient_type = 'new' THEN NEW.patient_type := 'old'; END IF;
    END IF;
  END IF;

  IF NEW.patient_code IS NULL THEN
    _base := upper(regexp_replace(COALESCE(NEW.patient_name, ''), '[^A-Za-z]', '', 'g'));
    _base := COALESCE(NULLIF(substring(_base from 1 for 3), ''), 'PAT');
    WHILE length(_base) < 3 LOOP _base := _base || 'X'; END LOOP;
    NEW.patient_code := _base || lpad((floor(random() * 1000000))::int::text, 6, '0');
  END IF;

  NEW.is_new_patient := (NEW.patient_type = 'new');

  IF NEW.fee_amount IS NULL AND NEW.chamber_id IS NOT NULL THEN
    SELECT c.fee_new, c.fee_old, c.fee_medical INTO _fee_new, _fee_old, _fee_med
      FROM public.rx_chambers c WHERE c.id = NEW.chamber_id;
    NEW.fee_amount := CASE
      WHEN NEW.patient_type = 'medical' THEN COALESCE(_fee_med, 0)
      WHEN NEW.patient_type = 'new' THEN _fee_new
      ELSE _fee_old END;
  ELSIF NEW.fee_amount IS NULL AND NEW.patient_type = 'medical' THEN
    NEW.fee_amount := 0;
  END IF;

  RETURN NEW;
END $$;

-- 3. Super admin can fix the sections a newly approved business owner gets
CREATE OR REPLACE FUNCTION public.approve_business_request(_id uuid, _notes text DEFAULT NULL::text, _sections text[] DEFAULT NULL::text[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.business_requests%ROWTYPE;
  v_biz_id uuid;
  v_uid uuid := auth.uid();
  v_role_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only super admin can approve business requests';
  END IF;
  SELECT * INTO v_req FROM public.business_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_req.status; END IF;

  INSERT INTO public.businesses (name, currency_id, sku_prefix, owner_id)
  VALUES (v_req.name, v_req.currency_id, v_req.sku_prefix, v_req.user_id)
  RETURNING id INTO v_biz_id;

  INSERT INTO public.business_locations (business_id, name, location_id)
  VALUES (v_biz_id, v_req.location_name, 'BL0001');

  IF _sections IS NOT NULL AND array_length(_sections, 1) > 0 THEN
    SELECT id INTO v_role_id FROM public.roles
     WHERE business_id = v_biz_id AND name ILIKE 'Admin%' ORDER BY name LIMIT 1;
    IF v_role_id IS NULL THEN
      INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
      VALUES (v_biz_id, 'Admin', true, _sections)
      RETURNING id INTO v_role_id;
    ELSE
      UPDATE public.roles SET allowed_sections = _sections WHERE id = v_role_id;
    END IF;

    INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
    VALUES (v_biz_id, v_req.user_id, true, true)
    ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

    DELETE FROM public.user_roles WHERE user_id = v_req.user_id AND business_id = v_biz_id;
    INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
    VALUES (v_req.user_id, v_role_id, v_biz_id, _sections);
  END IF;

  UPDATE public.business_requests
    SET status = 'approved', admin_notes = _notes, reviewed_by = v_uid,
        reviewed_at = now(), business_id = v_biz_id, updated_at = now()
    WHERE id = _id;

  RETURN v_biz_id;
END $$;