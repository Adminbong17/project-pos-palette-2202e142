CREATE TABLE public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigations TO authenticated;
GRANT ALL ON public.investigations TO service_role;

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage investigations"
ON public.investigations
FOR ALL
TO authenticated
USING (public.is_business_member(auth.uid(), business_id))
WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER set_investigations_updated_at
BEFORE UPDATE ON public.investigations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- seed shared list for every business from the bulk names currently in personal lists
INSERT INTO public.investigations (business_id, name)
SELECT b.id, s.name
FROM public.businesses b
CROSS JOIN (
  SELECT name FROM public.rx_presets WHERE kind = 'investigation'
  GROUP BY name HAVING count(DISTINCT user_id) > 1
) s
ON CONFLICT (business_id, name) DO NOTHING;

-- remove those shared names from doctors' personal lists
DELETE FROM public.rx_presets p
USING public.investigations i
WHERE p.kind = 'investigation'
  AND p.business_id = i.business_id
  AND lower(p.name) = lower(i.name);