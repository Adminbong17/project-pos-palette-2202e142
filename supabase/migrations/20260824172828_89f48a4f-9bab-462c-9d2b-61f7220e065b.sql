ALTER TABLE public.rx_staff
  ADD COLUMN IF NOT EXISTS staff_kind text NOT NULL DEFAULT 'doctor_assistant',
  ADD COLUMN IF NOT EXISTS role_label text,
  ADD COLUMN IF NOT EXISTS allowed_sections text[];

CREATE OR REPLACE FUNCTION public.provision_rx_staff(
  _business_id uuid,
  _user_id uuid,
  _email text,
  _name text,
  _phone text,
  _username text,
  _chamber_id uuid,
  _doctor_id uuid,
  _staff_kind text,
  _role_label text,
  _sections text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role_id uuid;
  _kind text := COALESCE(NULLIF(_staff_kind, ''), 'doctor_assistant');
  _doc uuid := COALESCE(_doctor_id, auth.uid());
  _secs text[] := COALESCE(NULLIF(_sections, '{}'::text[]), ARRAY['rx-queue']);
  _role_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.business_users
     WHERE business_id = _business_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'You are not a member of this business';
  END IF;

  IF _kind = 'clinic_staff' THEN
    _doc := auth.uid();
    _role_name := 'Clinic Staff' || COALESCE(' — ' || NULLIF(_role_label, ''), '');
  ELSE
    _role_name := 'Assistant';
    _secs := ARRAY['rx-queue'];
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
   WHERE business_id = _business_id AND name = _role_name LIMIT 1;
  IF _role_id IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (_business_id, _role_name, false, _secs) RETURNING id INTO _role_id;
  ELSE
    UPDATE public.roles SET allowed_sections = _secs WHERE id = _role_id;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND business_id = _business_id;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (_user_id, _role_id, _business_id, _secs);

  INSERT INTO public.rx_staff (business_id, doctor_id, user_id, name, phone, username, is_active, chamber_id, staff_kind, role_label, allowed_sections)
  VALUES (_business_id, _doc, _user_id, _name, NULLIF(_phone,''), _username, true, _chamber_id, _kind, NULLIF(_role_label,''), _secs)
  ON CONFLICT (business_id, username) DO UPDATE
    SET name = excluded.name,
        phone = excluded.phone,
        user_id = excluded.user_id,
        doctor_id = excluded.doctor_id,
        chamber_id = excluded.chamber_id,
        staff_kind = excluded.staff_kind,
        role_label = excluded.role_label,
        allowed_sections = excluded.allowed_sections,
        is_active = true;
END
$function$;