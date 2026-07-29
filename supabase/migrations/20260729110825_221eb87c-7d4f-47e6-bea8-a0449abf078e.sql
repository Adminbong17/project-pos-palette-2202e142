CREATE OR REPLACE FUNCTION public.create_purchase(_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_business_id uuid := (_payload->>'business_id')::uuid;
  v_location_id uuid := (_payload->>'location_id')::uuid;
  v_contact_id  uuid := NULLIF(_payload->>'contact_id','')::uuid;
  v_ref_no text     := _payload->>'ref_no';
  v_date  timestamptz := COALESCE((_payload->>'transaction_date')::timestamptz, now());
  v_status transaction_status := COALESCE((_payload->>'status')::transaction_status, 'received');
  v_notes text := _payload->>'additional_notes';
  v_amount_paid numeric := round(COALESCE((_payload->>'amount_paid')::numeric, 0), 2);
  v_payment_method text := COALESCE(_payload->>'payment_method', 'cash');
  v_lines jsonb := COALESCE(_payload->'lines', '[]'::jsonb);
  v_line jsonb;
  v_total numeric := 0;
  v_qty numeric;
  v_price numeric;
  v_tx_id uuid;
  v_payment_status payment_status;
  v_uid uuid := auth.uid();
  v_lot text;
  v_idx int := 0;
  v_batch_prefix text := 'B-' || to_char(v_date,'YYMMDD') || '-' || substr(md5(random()::text),1,4);
BEGIN
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_business_id) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;
  IF jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_price := COALESCE((v_line->>'purchase_price')::numeric, 0);
    v_total := v_total + (v_qty * v_price);
  END LOOP;
  v_total := round(v_total, 2);

  v_payment_status := CASE
    WHEN v_amount_paid >= v_total - 0.01 AND v_amount_paid > 0 THEN 'paid'::payment_status
    WHEN v_total <= 0 THEN 'paid'::payment_status
    WHEN v_amount_paid > 0 THEN 'partial'::payment_status
    ELSE 'due'::payment_status
  END;

  INSERT INTO public.transactions (
    business_id, location_id, type, status, payment_status, contact_id,
    ref_no, transaction_date, final_total, total_paid, additional_notes, created_by
  ) VALUES (
    v_business_id, v_location_id, 'purchase', v_status, v_payment_status, v_contact_id,
    v_ref_no, v_date, v_total,
    CASE WHEN v_payment_status = 'paid' AND v_amount_paid > 0 THEN v_total ELSE LEAST(v_amount_paid, v_total) END,
    v_notes, v_uid
  ) RETURNING id INTO v_tx_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_idx := v_idx + 1;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_price := COALESCE((v_line->>'purchase_price')::numeric, 0);
    v_lot := NULLIF(v_line->>'lot_no','');
    IF v_lot IS NULL THEN
      v_lot := v_batch_prefix || '-' || lpad(v_idx::text, 2, '0');
    END IF;

    INSERT INTO public.transaction_purchase_lines (
      transaction_id, product_id, variation_id, quantity, pp_without_discount, purchase_price, purchase_price_inc_tax, expire_date, lot_no
    ) VALUES (
      v_tx_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'variation_id')::uuid,
      v_qty, v_price, v_price, v_price,
      NULLIF(v_line->>'expire_date','')::date,
      v_lot
    );

    IF v_status = 'received' THEN
      INSERT INTO public.variation_location_details (product_id, variation_id, location_id, qty_available)
      VALUES ((v_line->>'product_id')::uuid, (v_line->>'variation_id')::uuid, v_location_id, v_qty)
      ON CONFLICT (variation_id, location_id) DO UPDATE
        SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available,
            updated_at = now();
    END IF;
  END LOOP;

  IF v_amount_paid > 0 THEN
    INSERT INTO public.transaction_payments (transaction_id, business_id, amount, method, paid_on, created_by)
    VALUES (v_tx_id, v_business_id,
      CASE WHEN v_payment_status = 'paid' THEN v_total ELSE LEAST(v_amount_paid, v_total) END,
      v_payment_method, now(), v_uid);
  END IF;

  RETURN v_tx_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_purchase(_id uuid, _payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_business_id uuid;
  v_location_id uuid := (_payload->>'location_id')::uuid;
  v_contact_id  uuid := NULLIF(_payload->>'contact_id','')::uuid;
  v_ref_no text := _payload->>'ref_no';
  v_date  timestamptz := COALESCE((_payload->>'transaction_date')::timestamptz, now());
  v_new_status transaction_status := COALESCE((_payload->>'status')::transaction_status, 'received');
  v_notes text := _payload->>'additional_notes';
  v_amount_paid numeric := round(COALESCE((_payload->>'amount_paid')::numeric, 0), 2);
  v_payment_method text := COALESCE(_payload->>'payment_method', 'cash');
  v_lines jsonb := COALESCE(_payload->'lines', '[]'::jsonb);
  v_line jsonb;
  v_total numeric := 0;
  v_qty numeric;
  v_price numeric;
  v_payment_status payment_status;
  v_uid uuid := auth.uid();
  v_old public.transaction_purchase_lines%ROWTYPE;
  v_lot text;
  v_idx int := 0;
  v_batch_prefix text := 'B-' || to_char(v_date,'YYMMDD') || '-' || substr(md5(random()::text),1,4);
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _id AND type = 'purchase';
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  v_business_id := v_tx.business_id;

  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_business_id) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;
  IF jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  IF v_tx.status = 'received' THEN
    FOR v_old IN SELECT * FROM public.transaction_purchase_lines WHERE transaction_id = _id LOOP
      UPDATE public.variation_location_details
        SET qty_available = qty_available - v_old.quantity, updated_at = now()
        WHERE variation_id = v_old.variation_id AND location_id = v_tx.location_id;
    END LOOP;
  END IF;

  DELETE FROM public.transaction_purchase_lines WHERE transaction_id = _id;
  DELETE FROM public.transaction_payments WHERE transaction_id = _id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_price := COALESCE((v_line->>'purchase_price')::numeric, 0);
    v_total := v_total + (v_qty * v_price);
  END LOOP;
  v_total := round(v_total, 2);

  v_payment_status := CASE
    WHEN v_amount_paid >= v_total - 0.01 AND v_amount_paid > 0 THEN 'paid'::payment_status
    WHEN v_total <= 0 THEN 'paid'::payment_status
    WHEN v_amount_paid > 0 THEN 'partial'::payment_status
    ELSE 'due'::payment_status
  END;

  UPDATE public.transactions
    SET location_id = v_location_id,
        contact_id = v_contact_id,
        ref_no = v_ref_no,
        transaction_date = v_date,
        status = v_new_status,
        payment_status = v_payment_status,
        final_total = v_total,
        total_paid = CASE WHEN v_payment_status = 'paid' AND v_amount_paid > 0 THEN v_total ELSE LEAST(v_amount_paid, v_total) END,
        additional_notes = v_notes,
        updated_at = now()
    WHERE id = _id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_idx := v_idx + 1;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_price := COALESCE((v_line->>'purchase_price')::numeric, 0);
    v_lot := NULLIF(v_line->>'lot_no','');
    IF v_lot IS NULL THEN
      v_lot := v_batch_prefix || '-' || lpad(v_idx::text, 2, '0');
    END IF;

    INSERT INTO public.transaction_purchase_lines (
      transaction_id, product_id, variation_id, quantity, pp_without_discount, purchase_price, purchase_price_inc_tax, expire_date, lot_no
    ) VALUES (
      _id,
      (v_line->>'product_id')::uuid,
      (v_line->>'variation_id')::uuid,
      v_qty, v_price, v_price, v_price,
      NULLIF(v_line->>'expire_date','')::date,
      v_lot
    );

    IF v_new_status = 'received' THEN
      INSERT INTO public.variation_location_details (product_id, variation_id, location_id, qty_available)
      VALUES ((v_line->>'product_id')::uuid, (v_line->>'variation_id')::uuid, v_location_id, v_qty)
      ON CONFLICT (variation_id, location_id) DO UPDATE
        SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available,
            updated_at = now();
    END IF;
  END LOOP;

  IF v_amount_paid > 0 THEN
    INSERT INTO public.transaction_payments (transaction_id, business_id, amount, method, paid_on, created_by)
    VALUES (_id, v_business_id,
      CASE WHEN v_payment_status = 'paid' THEN v_total ELSE LEAST(v_amount_paid, v_total) END,
      v_payment_method, now(), v_uid);
  END IF;

  RETURN _id;
END;
$function$;

UPDATE public.transactions
  SET payment_status = 'paid', total_paid = round(final_total, 2)
  WHERE type = 'purchase'
    AND payment_status <> 'paid'
    AND total_paid > 0
    AND total_paid >= round(final_total, 2) - 0.01;