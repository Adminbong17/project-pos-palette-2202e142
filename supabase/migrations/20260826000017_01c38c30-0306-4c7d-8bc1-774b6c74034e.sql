CREATE OR REPLACE FUNCTION public.is_business_owner(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    JOIN public.business_users bu
      ON bu.business_id = b.id
     AND bu.user_id = b.owner_id
     AND bu.is_active = true
    WHERE b.id = _business_id
      AND b.owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_business_owner(_user_id, _business_id)
    OR EXISTS (
      SELECT 1
      FROM public.business_users bu
      JOIN public.user_roles ur
        ON ur.user_id = bu.user_id
       AND ur.business_id = bu.business_id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE bu.user_id = _user_id
        AND bu.business_id = _business_id
        AND bu.is_active = true
        AND r.name ILIKE 'Admin%'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_any_business_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1
      FROM public.businesses b
      JOIN public.business_users bu
        ON bu.business_id = b.id
       AND bu.user_id = b.owner_id
       AND bu.is_active = true
      WHERE b.owner_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.business_users bu
      JOIN public.user_roles ur
        ON ur.user_id = bu.user_id
       AND ur.business_id = bu.business_id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE bu.user_id = _user_id
        AND bu.is_active = true
        AND r.name ILIKE 'Admin%'
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _business_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_business_owner(_user_id, _business_id)
    OR EXISTS (
      SELECT 1
      FROM public.business_users bu
      JOIN public.user_roles ur
        ON ur.user_id = bu.user_id
       AND ur.business_id = bu.business_id
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.app_permissions p ON p.id = rp.permission_id
      WHERE bu.user_id = _user_id
        AND bu.business_id = _business_id
        AND bu.is_active = true
        AND p.name = _permission
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role_name(_business_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.business_users bu
  JOIN public.user_roles ur
    ON ur.user_id = bu.user_id
   AND ur.business_id = bu.business_id
  JOIN public.roles r ON r.id = ur.role_id
  WHERE bu.user_id = auth.uid()
    AND bu.business_id = _business_id
    AND bu.is_active = true
  ORDER BY CASE WHEN r.name = 'Admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.rx_owner_doctor(_business_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.doctor_id
      FROM public.rx_staff s
      WHERE s.business_id = _business_id
        AND s.user_id = _user_id
        AND s.is_active = true
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_business_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_any_business_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role_name(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rx_owner_doctor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_any_business_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role_name(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rx_owner_doctor(uuid, uuid) TO authenticated, service_role;