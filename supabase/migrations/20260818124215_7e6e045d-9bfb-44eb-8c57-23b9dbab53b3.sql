-- 1. business kind ------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS biz_kind text NOT NULL DEFAULT 'pos';

UPDATE public.businesses SET biz_kind = 'clinic' WHERE clinic_mode IS TRUE AND biz_kind = 'pos';

-- 2. move a doctor (and their assistants + clinical data) to their own business
CREATE OR REPLACE FUNCTION public.move_doctor_to_own_business(_user_id uuid, _business_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old uuid;
  v_biz uuid;
  v_role uuid;
  v_cur integer;
  v_name text;
  v_loc uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only the super admin can move a doctor';
  END IF;

  SELECT business_id INTO v_old
  FROM public.business_users WHERE user_id = _user_id ORDER BY created_at NULLS LAST LIMIT 1;
  IF v_old IS NULL THEN RAISE EXCEPTION 'User has no business membership'; END IF;

  SELECT COALESCE(NULLIF(btrim(COALESCE(_business_name,'')),''),
                  NULLIF(btrim(COALESCE(p.doctor_name,'')),''),
                  NULLIF(btrim(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),
                  p.email)
    INTO v_name
  FROM public.profiles p WHERE p.id = _user_id;

  SELECT currency_id INTO v_cur FROM public.businesses WHERE currency_id IS NOT NULL LIMIT 1;

  INSERT INTO public.businesses (name, currency_id, owner_id, biz_kind)
  VALUES (v_name, v_cur, _user_id, 'doctor')
  RETURNING id INTO v_biz;

  INSERT INTO public.business_locations (business_id, name, location_id)
  VALUES (v_biz, v_name, 'BL0001')
  RETURNING id INTO v_loc;

  SELECT id INTO v_role FROM public.roles
   WHERE business_id = v_biz AND name ILIKE 'Doctor' LIMIT 1;
  IF v_role IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (v_biz, 'Doctor', false, ARRAY['prescriptions','rx-queue'])
    RETURNING id INTO v_role;
  END IF;

  -- the doctor becomes owner + Doctor role of the new business
  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  VALUES (v_biz, _user_id, true, true)
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND business_id = v_biz;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (_user_id, v_role, v_biz, ARRAY['prescriptions','rx-queue']);

  DELETE FROM public.user_roles WHERE user_id = _user_id AND business_id <> v_biz;
  DELETE FROM public.business_users WHERE user_id = _user_id AND business_id <> v_biz;
  UPDATE public.profiles SET current_business_id = v_biz WHERE id = _user_id;

  -- clinical data of this doctor
  UPDATE public.rx_chambers SET business_id = v_biz WHERE doctor_id = _user_id AND business_id = v_old;
  UPDATE public.rx_staff SET business_id = v_biz WHERE doctor_id = _user_id AND business_id = v_old;
  UPDATE public.rx_appointments SET business_id = v_biz WHERE doctor_id = _user_id AND business_id = v_old;
  UPDATE public.prescriptions
     SET business_id = v_biz, location_id = v_loc, contact_id = NULL, sale_id = NULL
   WHERE doctor_id = _user_id AND business_id = v_old;
  UPDATE public.rx_presets SET business_id = v_biz WHERE user_id = _user_id AND business_id = v_old;
  UPDATE public.rx_user_option_settings SET business_id = v_biz WHERE user_id = _user_id AND business_id = v_old;
  UPDATE public.rx_billing_accounts SET business_id = v_biz WHERE business_id = v_old
     AND user_id = _user_id;

  -- assistants that work under this doctor follow him
  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  SELECT v_biz, s.user_id, true, true FROM public.rx_staff s
   WHERE s.doctor_id = _user_id AND s.user_id IS NOT NULL
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  PERFORM public.ensure_assistant_role(v_biz, s.user_id)
    FROM public.rx_staff s WHERE s.doctor_id = _user_id AND s.user_id IS NOT NULL;

  DELETE FROM public.user_roles ur
   USING public.rx_staff s
   WHERE s.doctor_id = _user_id AND ur.user_id = s.user_id AND ur.business_id <> v_biz;
  DELETE FROM public.business_users bu
   USING public.rx_staff s
   WHERE s.doctor_id = _user_id AND bu.user_id = s.user_id AND bu.business_id <> v_biz;
  UPDATE public.profiles p SET current_business_id = v_biz
   WHERE p.id IN (SELECT user_id FROM public.rx_staff WHERE doctor_id = _user_id AND user_id IS NOT NULL);

  RETURN v_biz;
END
$$;

-- helper: give a user the Assistant role inside a business
CREATE OR REPLACE FUNCTION public.ensure_assistant_role(_business_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_role uuid;
BEGIN
  SELECT id INTO v_role FROM public.roles
   WHERE business_id = _business_id AND name ILIKE 'Assistant' LIMIT 1;
  IF v_role IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (_business_id, 'Assistant', false, ARRAY['rx-queue']) RETURNING id INTO v_role;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND business_id = _business_id;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (_user_id, v_role, _business_id, ARRAY['rx-queue']);
END
$$;

-- 3. approve a clinic signup into its own clinic business
CREATE OR REPLACE FUNCTION public.approve_access_request_clinic(_id uuid, _clinic_name text DEFAULT NULL, _sections text[] DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.access_requests%ROWTYPE;
  v_biz uuid;
  v_role uuid;
  v_cur integer;
  v_name text;
  v_sections text[] := COALESCE(_sections, ARRAY['prescriptions','rx-queue']);
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only the super admin can approve a clinic';
  END IF;

  SELECT * INTO v_req FROM public.access_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_req.status; END IF;

  v_name := COALESCE(NULLIF(btrim(COALESCE(_clinic_name,'')),''), NULLIF(v_req.full_name,''), v_req.email);

  SELECT currency_id INTO v_cur FROM public.businesses WHERE currency_id IS NOT NULL LIMIT 1;

  INSERT INTO public.businesses (name, currency_id, owner_id, clinic_mode, biz_kind)
  VALUES (v_name, v_cur, v_req.user_id, true, 'clinic')
  RETURNING id INTO v_biz;

  INSERT INTO public.business_locations (business_id, name, location_id)
  VALUES (v_biz, v_name, 'BL0001');

  INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
  VALUES (v_biz, 'Clinic Admin', false, v_sections)
  RETURNING id INTO v_role;

  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  VALUES (v_biz, v_req.user_id, true, true)
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  DELETE FROM public.user_roles WHERE user_id = v_req.user_id;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (v_req.user_id, v_role, v_biz, v_sections);
  DELETE FROM public.business_users WHERE user_id = v_req.user_id AND business_id <> v_biz;

  UPDATE public.profiles SET current_business_id = v_biz WHERE id = v_req.user_id;

  UPDATE public.access_requests
     SET status = 'approved', business_id = v_biz, admin_notes = _notes,
         reviewed_by = v_uid, reviewed_at = now(), requested_role = 'Clinic Admin'
   WHERE id = _id;

  RETURN v_biz;
END
$$;

-- 4. clinic admin creates a doctor account inside the clinic
CREATE OR REPLACE FUNCTION public.provision_clinic_doctor(_business_id uuid, _user_id uuid, _email text, _name text, _phone text, _qualification text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_role uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.business_users
     WHERE business_id = _business_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'You are not a member of this clinic';
  END IF;

  INSERT INTO public.profiles (id, email, first_name, doctor_name, doctor_qualification, phone)
  VALUES (_user_id, _email, _name, _name, NULLIF(btrim(COALESCE(_qualification,'')),''), NULLIF(btrim(COALESCE(_phone,'')),''))
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    first_name = excluded.first_name,
    doctor_name = excluded.doctor_name,
    doctor_qualification = excluded.doctor_qualification,
    phone = COALESCE(excluded.phone, public.profiles.phone);

  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  VALUES (_business_id, _user_id, true, true)
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  SELECT id INTO v_role FROM public.roles
   WHERE business_id = _business_id AND name ILIKE 'Doctor' LIMIT 1;
  IF v_role IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (_business_id, 'Doctor', false, ARRAY['prescriptions','rx-queue'])
    RETURNING id INTO v_role;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND business_id = _business_id;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (_user_id, v_role, _business_id, ARRAY['prescriptions','rx-queue']);
END
$$;

-- 5. assistants can be created under a chosen doctor (clinic use)
CREATE OR REPLACE FUNCTION public.provision_rx_staff(_business_id uuid, _user_id uuid, _email text, _name text, _phone text, _username text, _chamber_id uuid, _doctor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role_id uuid;
  _doc uuid := COALESCE(_doctor_id, auth.uid());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.business_users
     WHERE business_id = _business_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'You are not a member of this business';
  END IF;

  IF _doc <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.business_users
     WHERE business_id = _business_id AND user_id = _doc AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected doctor is not part of this business';
  END IF;

  IF _chamber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rx_chambers WHERE id = _chamber_id AND business_id = _business_id
  ) THEN
    RAISE EXCEPTION 'Invalid location for this business';
  END IF;

  INSERT INTO public.profiles (id, email, first_name)
  VALUES (_user_id, _email, _name)
  ON CONFLICT (id) DO UPDATE SET email = excluded.email, first_name = excluded.first_name;

  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  VALUES (_business_id, _user_id, true, true)
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  SELECT id INTO _role_id FROM public.roles
   WHERE business_id = _business_id AND name ILIKE 'Assistant' LIMIT 1;
  IF _role_id IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (_business_id, 'Assistant', false, ARRAY['rx-queue']) RETURNING id INTO _role_id;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND business_id = _business_id;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (_user_id, _role_id, _business_id, ARRAY['rx-queue']);

  INSERT INTO public.rx_staff (business_id, doctor_id, user_id, name, phone, username, is_active, chamber_id)
  VALUES (_business_id, _doc, _user_id, _name, NULLIF(_phone,''), _username, true, _chamber_id)
  ON CONFLICT (business_id, username) DO UPDATE
    SET name = excluded.name,
        phone = excluded.phone,
        user_id = excluded.user_id,
        doctor_id = excluded.doctor_id,
        chamber_id = excluded.chamber_id,
        is_active = true;
END
$$;