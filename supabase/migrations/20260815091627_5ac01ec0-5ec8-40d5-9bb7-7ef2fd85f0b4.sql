ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON public.transactions (business_id, type, deleted_at);

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
  v_prev_map jsonb := '{}'::jsonb;
  v_pack_map jsonb := '{}'::jsonb;
  v_key text;
  v_var uuid;
  v_prev numeric;
  v_pack numeric;
  v_prev_pack numeric;
  v_prod uuid;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _id AND type = 'purchase' AND deleted_at IS NULL;
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
    IF v_line.variation_id IS NOT NULL THEN
      v_prev_map := v_prev_map || jsonb_build_object(v_line.variation_id::text, to_jsonb(v_line.prev_purchase_price));
      v_pack_map := v_pack_map || jsonb_build_object(v_line.variation_id::text, to_jsonb(v_line.prev_pack_size));
    END IF;
  END LOOP;

  UPDATE public.transactions SET deleted_at = now(), deleted_by = v_uid, updated_at = now() WHERE id = _id;

  FOR v_key IN SELECT jsonb_object_keys(v_prev_map) LOOP
    v_var := v_key::uuid;

    v_prev_pack := NULLIF(v_pack_map->>v_key, 'null')::numeric;
    IF v_prev_pack IS NOT NULL AND v_prev_pack > 0 THEN
      UPDATE public.variations
        SET pack_size = v_prev_pack, updated_at = now()
        WHERE id = v_var AND COALESCE(NULLIF(pack_size, 0), 1) <> v_prev_pack;
    END IF;

    SELECT COALESCE(NULLIF(pack_size, 0), 1), product_id INTO v_pack, v_prod
      FROM public.variations WHERE id = v_var;
    IF v_pack IS NULL THEN CONTINUE; END IF;

    SELECT l.purchase_price INTO v_prev
      FROM public.transaction_purchase_lines l
      JOIN public.transactions t ON t.id = l.transaction_id
      WHERE l.variation_id = v_var AND t.type = 'purchase' AND t.deleted_at IS NULL
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 1;

    IF v_prev IS NULL THEN
      v_prev := NULLIF(v_prev_map->>v_key, 'null')::numeric;
    END IF;

    IF v_prev IS NULL THEN CONTINUE; END IF;
    v_prev := round(v_prev / v_pack, 4);

    UPDATE public.variations
      SET default_purchase_price = v_prev, dpp_inc_tax = v_prev, updated_at = now()
      WHERE id = v_var;
    IF v_prod IS NOT NULL THEN
      UPDATE public.products SET default_purchase_price = v_prev WHERE id = v_prod;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_purchase(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_uid uuid := auth.uid();
  v_line public.transaction_purchase_lines%ROWTYPE;
  v_pack numeric;
  v_prod uuid;
  v_price numeric;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _id AND type = 'purchase' AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted purchase not found'; END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_tx.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.transactions SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id = _id;

  FOR v_line IN SELECT * FROM public.transaction_purchase_lines WHERE transaction_id = _id LOOP
    IF v_tx.status = 'received' AND v_line.variation_id IS NOT NULL THEN
      INSERT INTO public.variation_location_details (product_id, variation_id, location_id, qty_available)
      VALUES (v_line.product_id, v_line.variation_id, v_tx.location_id, v_line.quantity)
      ON CONFLICT (variation_id, location_id) DO UPDATE
        SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available,
            updated_at = now();
    END IF;

    IF v_line.variation_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(pack_size, 0), 1), product_id INTO v_pack, v_prod
        FROM public.variations WHERE id = v_line.variation_id;
      IF v_pack IS NOT NULL THEN
        v_price := round(COALESCE(v_line.purchase_price, 0) / v_pack, 4);
        IF v_price > 0 THEN
          UPDATE public.variations
            SET default_purchase_price = v_price, dpp_inc_tax = v_price, updated_at = now()
            WHERE id = v_line.variation_id;
          IF v_prod IS NOT NULL THEN
            UPDATE public.products SET default_purchase_price = v_price WHERE id = v_prod;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_purchase(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _id AND type = 'purchase' AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted purchase not found'; END IF;
  IF v_uid IS NULL OR NOT public.is_business_admin(v_uid, v_tx.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.transaction_payments WHERE transaction_id = _id;
  DELETE FROM public.transaction_purchase_lines WHERE transaction_id = _id;
  DELETE FROM public.transactions WHERE id = _id;
END;
$function$;