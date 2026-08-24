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
  ELSIF _kind = 'medicine' THEN
    RETURN QUERY SELECT p.id, p.name FROM public.products p
      WHERE p.business_id = _biz AND coalesce(p.is_inactive, false) = false
        AND (_q IS NULL OR p.name ILIKE '%' || _q || '%')
      ORDER BY (CASE WHEN _q IS NOT NULL AND p.name ILIKE _q || '%' THEN 0 ELSE 1 END), p.name LIMIT _lim;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rx_master_options(text, integer, text) TO authenticated;