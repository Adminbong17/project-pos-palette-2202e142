CREATE TABLE IF NOT EXISTS public.rx_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand_name text,
  generic_name text,
  strength text,
  dosage_form text,
  manufacturer text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rx_medicines_name_key ON public.rx_medicines (lower(name));
CREATE INDEX IF NOT EXISTS rx_medicines_name_trgm ON public.rx_medicines (name text_pattern_ops);
CREATE INDEX IF NOT EXISTS rx_medicines_generic_idx ON public.rx_medicines (generic_name);

GRANT SELECT ON public.rx_medicines TO authenticated;
GRANT ALL ON public.rx_medicines TO service_role;

ALTER TABLE public.rx_medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read the shared medicine list" ON public.rx_medicines;
CREATE POLICY "Signed-in users can read the shared medicine list"
ON public.rx_medicines FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.rx_master_options(_kind text, _limit integer, _search text)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _biz uuid;
  _q text := nullif(btrim(coalesce(_search, '')), '');
  _lim integer := least(greatest(coalesce(_limit, 1000), 1), 20000);
BEGIN
  IF _kind = 'medicine' THEN
    RETURN QUERY SELECT m.id, m.name FROM public.rx_medicines m
      WHERE m.is_active AND (_q IS NULL OR m.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND m.name ILIKE _q || '%' THEN 0 ELSE 1 END), m.name LIMIT _lim;
    RETURN;
  END IF;

  SELECT b.id INTO _biz FROM public.businesses b WHERE b.is_rx_master = true ORDER BY b.created_at LIMIT 1;
  IF _biz IS NULL THEN RETURN; END IF;

  IF _kind = 'cc' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.chief_complaints c
      WHERE c.business_id = _biz AND (_q IS NULL OR c.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND c.name ILIKE _q || '%' THEN 0 ELSE 1 END), c.name LIMIT _lim;
  ELSIF _kind = 'investigation' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.investigations c
      WHERE c.business_id = _biz AND (_q IS NULL OR c.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND c.name ILIKE _q || '%' THEN 0 ELSE 1 END), c.name LIMIT _lim;
  ELSIF _kind = 'frequency' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.rx_frequencies c
      WHERE c.business_id = _biz AND (_q IS NULL OR c.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND c.name ILIKE _q || '%' THEN 0 ELSE 1 END), c.name LIMIT _lim;
  ELSIF _kind = 'instruction' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.rx_instructions c
      WHERE c.business_id = _biz AND (_q IS NULL OR c.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND c.name ILIKE _q || '%' THEN 0 ELSE 1 END), c.name LIMIT _lim;
  ELSIF _kind = 'advice' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.rx_advices c
      WHERE c.business_id = _biz AND (_q IS NULL OR c.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND c.name ILIKE _q || '%' THEN 0 ELSE 1 END), c.name LIMIT _lim;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rx_master_options(text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rx_master_options(_kind text, _limit integer DEFAULT 3000)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.rx_master_options(_kind, _limit, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.rx_master_options(text, integer) TO authenticated;