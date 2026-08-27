CREATE TABLE public.lab_signatories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'technologist',
  name text NOT NULL,
  designation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lab_signatories_business_idx ON public.lab_signatories (business_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_signatories TO authenticated;
GRANT ALL ON public.lab_signatories TO service_role;

ALTER TABLE public.lab_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view lab signatories"
ON public.lab_signatories FOR SELECT TO authenticated
USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can add lab signatories"
ON public.lab_signatories FOR INSERT TO authenticated
WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can update lab signatories"
ON public.lab_signatories FOR UPDATE TO authenticated
USING (public.is_business_member(auth.uid(), business_id))
WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Business members can delete lab signatories"
ON public.lab_signatories FOR DELETE TO authenticated
USING (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER lab_signatories_updated_at BEFORE UPDATE ON public.lab_signatories
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();