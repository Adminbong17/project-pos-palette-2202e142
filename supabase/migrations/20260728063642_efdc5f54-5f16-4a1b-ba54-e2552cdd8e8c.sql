CREATE TABLE public.chief_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chief_complaints TO authenticated;
GRANT ALL ON public.chief_complaints TO service_role;

ALTER TABLE public.chief_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage chief complaints"
ON public.chief_complaints
FOR ALL
TO authenticated
USING (public.is_business_member(auth.uid(), business_id))
WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER set_chief_complaints_updated_at
BEFORE UPDATE ON public.chief_complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();