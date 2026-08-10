CREATE OR REPLACE FUNCTION public.delete_purchase(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_uid uuid := auth.uid();
  v_line public.transaction_purchase_lines%ROWTYPE;
  v_vars uuid[] := '{}';
  v_var uuid;
  v_prev numeric;
  v_pack numeric;
  v_prod uuid;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _id AND type = 'purchase';
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_tx.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_line IN SELECT * FROM public.transaction_purchase_lines WHERE transaction_id = _id LOOP
    IF v_tx.status = 'received' THEN
      UPDATE public.variation_location_details
        SET qty_available = qty_available - v_line.quantity, updated_at = now()
        WHERE variation_id = v_line.variation_id AND location_id = v_tx.location_id;
    END IF;
    IF v_line.variation_id IS NOT NULL AND NOT (v_line.variation_id = ANY(v_vars)) THEN
      v_vars := array_append(v_vars, v_line.variation_id);
    END IF;
  END LOOP;

  DELETE FROM public.transaction_payments WHERE transaction_id = _id;
  DELETE FROM public.transaction_purchase_lines WHERE transaction_id = _id;
  DELETE FROM public.transactions WHERE id = _id;

  -- Roll purchase price back to the latest remaining purchase for each item
  FOREACH v_var IN ARRAY v_vars LOOP
    SELECT COALESCE(NULLIF(pack_size, 0), 1), product_id INTO v_pack, v_prod
      FROM public.variations WHERE id = v_var;
    IF v_pack IS NULL THEN CONTINUE; END IF;

    SELECT l.purchase_price INTO v_prev
      FROM public.transaction_purchase_lines l
      JOIN public.transactions t ON t.id = l.transaction_id
      WHERE l.variation_id = v_var AND t.type = 'purchase'
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 1;

    IF v_prev IS NULL THEN CONTINUE; END IF;
    v_prev := round(v_prev / v_pack, 2);

    UPDATE public.variations
      SET default_purchase_price = v_prev, dpp_inc_tax = v_prev, updated_at = now()
      WHERE id = v_var;
    IF v_prod IS NOT NULL THEN
      UPDATE public.products SET default_purchase_price = v_prev WHERE id = v_prod;
    END IF;
  END LOOP;
END;
$function$;