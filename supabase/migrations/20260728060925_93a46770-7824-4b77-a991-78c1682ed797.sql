ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS doctor_qualification text;

CREATE OR REPLACE FUNCTION public.can_manage_member_profile(_manager uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users me
    JOIN public.business_users them ON them.business_id = me.business_id
    WHERE me.user_id = _manager AND me.is_active = true
      AND them.user_id = _target AND them.is_active = true
      AND (
        public.is_business_owner(_manager, me.business_id)
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = _manager AND ur.business_id = me.business_id
            AND r.name ILIKE 'Admin%'
        )
      )
  );
$$;

DROP POLICY IF EXISTS "profiles admin manage" ON public.profiles;
CREATE POLICY "profiles admin manage"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.can_manage_member_profile(auth.uid(), id))
WITH CHECK (public.can_manage_member_profile(auth.uid(), id));