-- Set mehedi2001mzs17@gmail.com as the ONLY Super Admin of the platform.
-- admin@bongbangla.top remains strictly the business/store admin of Sheikh Pharma.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) = 'mehedi2001mzs17@gmail.com'
  );
$$;
