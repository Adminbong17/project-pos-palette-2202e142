CREATE TABLE public.rx_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cc','vital','investigation','frequency','advice','medicine')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rx_presets_unique ON public.rx_presets (user_id, kind, lower(name));
CREATE INDEX rx_presets_lookup ON public.rx_presets (user_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_presets TO authenticated;
GRANT ALL ON public.rx_presets TO service_role;

ALTER TABLE public.rx_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors manage own presets"
  ON public.rx_presets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER rx_presets_updated_at BEFORE UPDATE ON public.rx_presets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();