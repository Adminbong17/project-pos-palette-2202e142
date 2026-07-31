CREATE TABLE public.rx_advices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_advices TO authenticated;
GRANT ALL ON public.rx_advices TO service_role;

ALTER TABLE public.rx_advices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage rx advices"
ON public.rx_advices FOR ALL TO authenticated
USING (public.is_business_member(auth.uid(), business_id))
WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER rx_advices_set_updated_at
BEFORE UPDATE ON public.rx_advices
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();