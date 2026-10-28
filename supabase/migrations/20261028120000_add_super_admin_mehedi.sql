-- Migration to recognize both admin@bongbangla.top and mehedi2001mzs17@gmail.com as Super Admins
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) IN ('admin@bongbangla.top', 'mehedi2001mzs17@gmail.com')
  );
$$;
