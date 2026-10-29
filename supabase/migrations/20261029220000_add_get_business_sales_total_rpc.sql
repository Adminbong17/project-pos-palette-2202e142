CREATE OR REPLACE FUNCTION public.get_business_sales_total(_business_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total numeric;
BEGIN
  IF current_user IN ('postgres', 'service_role')
     OR (v_uid IS NOT NULL AND (
          is_super_admin(v_uid)
          OR is_business_member(v_uid, _business_id)
          OR EXISTS (SELECT 1 FROM public.businesses WHERE id = _business_id AND owner_id = v_uid)
        ))
  THEN
    SELECT COALESCE(SUM(final_total), 0)
      INTO v_total
      FROM public.transactions
     WHERE business_id = _business_id
       AND type = 'sell';
    RETURN v_total;
  ELSE
    RETURN 0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_sales_total(uuid) TO authenticated, anon;
