CREATE OR REPLACE FUNCTION public.delete_purchase(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_uid uuid := auth.uid();
  v_line public.transaction_purchase_lines%ROWTYPE;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _id AND type = 'purchase';
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_tx.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_tx.status = 'received' THEN
    FOR v_line IN SELECT * FROM public.transaction_purchase_lines WHERE transaction_id = _id LOOP
      UPDATE public.variation_location_details
        SET qty_available = qty_available - v_line.quantity, updated_at = now()
        WHERE variation_id = v_line.variation_id AND location_id = v_tx.location_id;
    END LOOP;
  END IF;

  DELETE FROM public.transaction_payments WHERE transaction_id = _id;
  DELETE FROM public.transaction_purchase_lines WHERE transaction_id = _id;
  DELETE FROM public.transactions WHERE id = _id;
END;
$$;