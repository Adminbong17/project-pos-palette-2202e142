-- helper: is user an admin (owner or Admin role) of a business
CREATE OR REPLACE FUNCTION public.is_business_admin(_user_id uuid, _business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_business_owner(_user_id, _business_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user_id AND ur.business_id = _business_id AND r.name ILIKE 'Admin%'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_any_business_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user_id AND r.name ILIKE 'Admin%'
    );
$$;

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  phone text,
  qualification text,
  requested_role text NOT NULL DEFAULT 'Doctor',
  status text NOT NULL DEFAULT 'pending',
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX access_requests_pending_user_idx
  ON public.access_requests (user_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create their own request" ON public.access_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read their own request" ON public.access_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_any_business_admin(auth.uid()));
CREATE POLICY "Admins update requests" ON public.access_requests
  FOR UPDATE TO authenticated USING (public.is_any_business_admin(auth.uid()))
  WITH CHECK (public.is_any_business_admin(auth.uid()));

CREATE TRIGGER access_requests_updated_at BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.rx_user_option_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_user_option_settings TO authenticated;
GRANT ALL ON public.rx_user_option_settings TO service_role;
ALTER TABLE public.rx_user_option_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read rx user option settings" ON public.rx_user_option_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_business_admin(auth.uid(), business_id));
CREATE POLICY "Admins manage rx user option settings" ON public.rx_user_option_settings
  FOR ALL TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id))
  WITH CHECK (public.is_business_admin(auth.uid(), business_id));

CREATE TRIGGER rx_user_option_settings_updated_at BEFORE UPDATE ON public.rx_user_option_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- approve a signup request into a business with a role + section access
CREATE OR REPLACE FUNCTION public.approve_access_request(
  _id uuid,
  _business_id uuid,
  _role text DEFAULT 'Doctor',
  _sections text[] DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.access_requests%ROWTYPE;
  v_role_id uuid;
  v_role_name text := COALESCE(NULLIF(_role, ''), 'Doctor');
BEGIN
  IF v_uid IS NULL OR NOT public.is_business_admin(v_uid, _business_id) THEN
    RAISE EXCEPTION 'Only business admins can approve requests';
  END IF;
  SELECT * INTO v_req FROM public.access_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_req.status; END IF;

  SELECT id INTO v_role_id FROM public.roles
   WHERE business_id = _business_id
     AND name ILIKE (CASE WHEN v_role_name = 'Admin' THEN 'Admin%' ELSE v_role_name END)
   ORDER BY name LIMIT 1;

  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (business_id, name, is_default, allowed_sections)
    VALUES (_business_id, v_role_name, false,
      CASE WHEN v_role_name = 'Doctor' THEN ARRAY['prescriptions'] ELSE NULL END)
    RETURNING id INTO v_role_id;
  END IF;

  INSERT INTO public.business_users (business_id, user_id, access_all_locations, is_active)
  VALUES (_business_id, v_req.user_id, true, true)
  ON CONFLICT (business_id, user_id) DO UPDATE SET is_active = true;

  DELETE FROM public.user_roles WHERE user_id = v_req.user_id AND business_id = _business_id;
  INSERT INTO public.user_roles (user_id, role_id, business_id, allowed_sections)
  VALUES (v_req.user_id, v_role_id, _business_id,
    COALESCE(_sections, CASE WHEN v_role_name = 'Doctor' THEN ARRAY['prescriptions'] ELSE NULL END));

  UPDATE public.profiles
     SET current_business_id = COALESCE(current_business_id, _business_id),
         doctor_name = CASE WHEN v_role_name = 'Doctor' THEN COALESCE(doctor_name, v_req.full_name) ELSE doctor_name END,
         doctor_qualification = CASE WHEN v_role_name = 'Doctor' THEN COALESCE(doctor_qualification, v_req.qualification) ELSE doctor_qualification END
   WHERE id = v_req.user_id;

  UPDATE public.access_requests
     SET status = 'approved', business_id = _business_id, admin_notes = _notes,
         reviewed_by = v_uid, reviewed_at = now(), requested_role = v_role_name
   WHERE id = _id;

  RETURN v_req.user_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_access_request(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_any_business_admin(v_uid) THEN
    RAISE EXCEPTION 'Only business admins can reject requests';
  END IF;
  UPDATE public.access_requests
     SET status = 'rejected', admin_notes = _notes, reviewed_by = v_uid, reviewed_at = now()
   WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
END $$;