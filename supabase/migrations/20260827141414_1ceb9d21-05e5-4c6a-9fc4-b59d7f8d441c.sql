CREATE TABLE public.lab_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by uuid,
  test_id text,
  test_name text NOT NULL,
  department text,
  specimen text,
  patient_name text,
  patient_code text,
  age text,
  gender text,
  phone_no text,
  referred_by text,
  sample_no text,
  collected_at_text text,
  reported_at_text text,
  comment text,
  tech_name text,
  tech_designation text,
  pathologist_name text,
  pathologist_designation text,
  own_pad boolean NOT NULL DEFAULT false,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_reports TO authenticated;
GRANT ALL ON public.lab_reports TO service_role;

ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view lab reports" ON public.lab_reports FOR SELECT TO authenticated USING (is_business_member(auth.uid(), business_id));
CREATE POLICY "Business members can add lab reports" ON public.lab_reports FOR INSERT TO authenticated WITH CHECK (is_business_member(auth.uid(), business_id));
CREATE POLICY "Business members can update lab reports" ON public.lab_reports FOR UPDATE TO authenticated USING (is_business_member(auth.uid(), business_id)) WITH CHECK (is_business_member(auth.uid(), business_id));
CREATE POLICY "Business members can delete lab reports" ON public.lab_reports FOR DELETE TO authenticated USING (is_business_member(auth.uid(), business_id));

CREATE INDEX lab_reports_business_created_idx ON public.lab_reports (business_id, created_at DESC);

CREATE TRIGGER lab_reports_set_updated_at BEFORE UPDATE ON public.lab_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();