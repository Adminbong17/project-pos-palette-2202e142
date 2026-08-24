ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_rx_master boolean NOT NULL DEFAULT false;

UPDATE public.businesses SET is_rx_master = true WHERE id = 'c82c76de-9574-4dbb-bb08-775794244650';

CREATE OR REPLACE FUNCTION public.rx_master_options(_kind text, _limit integer DEFAULT 3000)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF _kind = 'cc' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.chief_complaints c
      JOIN public.businesses b ON b.id = c.business_id AND b.is_rx_master
      ORDER BY c.name LIMIT _limit;
  ELSIF _kind = 'investigation' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.investigations c
      JOIN public.businesses b ON b.id = c.business_id AND b.is_rx_master
      ORDER BY c.name LIMIT _limit;
  ELSIF _kind = 'frequency' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.rx_frequencies c
      JOIN public.businesses b ON b.id = c.business_id AND b.is_rx_master
      ORDER BY c.name LIMIT _limit;
  ELSIF _kind = 'instruction' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.rx_instructions c
      JOIN public.businesses b ON b.id = c.business_id AND b.is_rx_master
      ORDER BY c.name LIMIT _limit;
  ELSIF _kind = 'advice' THEN
    RETURN QUERY SELECT c.id, c.name FROM public.rx_advices c
      JOIN public.businesses b ON b.id = c.business_id AND b.is_rx_master
      ORDER BY c.name LIMIT _limit;
  ELSIF _kind = 'medicine' THEN
    RETURN QUERY SELECT p.id, p.name FROM public.products p
      JOIN public.businesses b ON b.id = p.business_id AND b.is_rx_master
      WHERE p.is_inactive = false
      ORDER BY p.name LIMIT _limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rx_master_options(text, integer) TO authenticated;