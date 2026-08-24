ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address text;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='businesses' AND cmd IN ('UPDATE','ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.businesses', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owners and admins can update their business"
ON public.businesses FOR UPDATE TO authenticated
USING (public.is_business_owner(auth.uid(), id) OR public.is_business_admin(auth.uid(), id) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_business_owner(auth.uid(), id) OR public.is_business_admin(auth.uid(), id) OR public.is_super_admin(auth.uid()));