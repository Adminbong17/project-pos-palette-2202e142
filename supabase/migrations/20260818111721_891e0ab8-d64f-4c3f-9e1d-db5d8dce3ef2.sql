CREATE OR REPLACE FUNCTION public.approve_access_request_new_business(
  _id uuid,
  _business_name text DEFAULT NULL,
  _sections text[] DEFAULT NULL,
  _notes text DEFAULT NULL
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
  v_cur uuid;
  v_name text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only the super admin can create a separate business';
  END IF;

  SELECT * INTO v_req FROM public.access_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_req.status; END IF;

  v_name := COALESCE(NULLIF(btrim(COALESCE(_business_name, '')), ''), NULLIF(v_req.full_name, ''), v_req.email);

  SELECT currency_id INTO v_cur FROM public.businesses WHERE currency_id IS NOT NULL LIMIT 1;

  INSERT INTO public.businesses (name, currency_id, owner_id)
  VALUES (v_name, v_cur, v_req.user_id)
  RETURNING id INTO v_biz;

  INSERT INTO public.business_locations (business_id, name, location_id)
  VALUES (v_biz, v_name, 'BL0001');

  -- handle_new_business() already created the Admin role + membership.
  SELECT id INTO v_role FROM public.roles
   WHERE business_id = v_biz AND name ILIKE 'Admin%' ORDER BY name LIMIT 1;
  IF v_role IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (v_biz, 'Admin', true, _sections) RETURNING id INTO v_role;
  ELSE
    UPDATE public.roles SET allowed_sections = _sections WHERE id = v_role;
  END IF;

  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  VALUES (v_biz, v_req.user_id, true, true)
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  DELETE FROM public.user_roles WHERE user_id = v_req.user_id AND business_id = v_biz;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (v_req.user_id, v_role, v_biz, _sections);

  -- The new owner must never stay attached to another business (e.g. Sheikh pharma).
  DELETE FROM public.user_roles WHERE user_id = v_req.user_id AND business_id <> v_biz;
  DELETE FROM public.business_users WHERE user_id = v_req.user_id AND business_id <> v_biz;

  UPDATE public.profiles SET current_business_id = v_biz WHERE id = v_req.user_id;

  UPDATE public.access_requests
     SET status = 'approved', business_id = v_biz, admin_notes = _notes,
         reviewed_by = v_uid, reviewed_at = now(), requested_role = 'Admin'
   WHERE id = _id;

  RETURN v_biz;
END $function$;

GRANT EXECUTE ON FUNCTION public.approve_access_request_new_business(uuid, text, text[], text) TO authenticated;