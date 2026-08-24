ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS clinic_type text NOT NULL DEFAULT 'general';

CREATE OR REPLACE FUNCTION public.tg_businesses_validate_clinic_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_type IS NULL OR NEW.clinic_type NOT IN ('general','dental') THEN
    RAISE EXCEPTION 'clinic_type must be general or dental';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS businesses_validate_clinic_type ON public.businesses;
CREATE TRIGGER businesses_validate_clinic_type
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.tg_businesses_validate_clinic_type();

DROP FUNCTION IF EXISTS public.approve_access_request_clinic(uuid, text, text[], text);

CREATE OR REPLACE FUNCTION public.approve_access_request_clinic(
  _id uuid,
  _clinic_name text DEFAULT NULL::text,
  _sections text[] DEFAULT NULL::text[],
  _notes text DEFAULT NULL::text,
  _clinic_type text DEFAULT 'general'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.access_requests%ROWTYPE;
  v_biz uuid;
  v_role uuid;
  v_cur integer;
  v_name text;
  v_kind text := CASE WHEN lower(COALESCE(_clinic_type,'general')) = 'dental' THEN 'dental' ELSE 'general' END;
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

  INSERT INTO public.businesses (name, currency_id, owner_id, clinic_mode, biz_kind, clinic_type)
  VALUES (v_name, v_cur, v_req.user_id, true, 'clinic', v_kind)
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
$function$;