CREATE TABLE public.rx_option_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_option_settings TO authenticated;
GRANT ALL ON public.rx_option_settings TO service_role;

ALTER TABLE public.rx_option_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read rx option settings"
ON public.rx_option_settings FOR SELECT TO authenticated
USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "admins can manage rx option settings"
ON public.rx_option_settings FOR ALL TO authenticated
USING (public.is_business_owner(auth.uid(), business_id) OR public.has_permission(auth.uid(), business_id, 'settings.access'))
WITH CHECK (public.is_business_owner(auth.uid(), business_id) OR public.has_permission(auth.uid(), business_id, 'settings.access'));

CREATE TRIGGER rx_option_settings_updated_at BEFORE UPDATE ON public.rx_option_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();