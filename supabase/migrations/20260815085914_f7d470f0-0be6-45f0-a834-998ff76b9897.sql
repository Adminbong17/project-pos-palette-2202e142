ALTER TABLE public.transaction_purchase_lines
  ADD COLUMN IF NOT EXISTS prev_purchase_price numeric;

-- Snapshot the pre-purchase cost (per box, matching purchase_price units) on insert
CREATE OR REPLACE FUNCTION public.tg_snapshot_prev_purchase_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack numeric;
  v_dpp numeric;
BEGIN
  IF NEW.prev_purchase_price IS NULL AND NEW.variation_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(pack_size, 0), 1), default_purchase_price
      INTO v_pack, v_dpp
      FROM public.variations WHERE id = NEW.variation_id;
    IF v_dpp IS NOT NULL THEN
      NEW.prev_purchase_price := v_dpp * COALESCE(v_pack, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_prev_purchase_price ON public.transaction_purchase_lines;
CREATE TRIGGER trg_snapshot_prev_purchase_price
BEFORE INSERT ON public.transaction_purchase_lines
FOR EACH ROW EXECUTE FUNCTION public.tg_snapshot_prev_purchase_price();

CREATE OR REPLACE FUNCTION public.delete_purchase(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_uid uuid := auth.uid();
  v_line public.transaction_purchase_lines%ROWTYPE;
  v_prev_map jsonb := '{}'::jsonb;
  v_key text;
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
    IF v_line.variation_id IS NOT NULL THEN
      v_prev_map := v_prev_map || jsonb_build_object(
        v_line.variation_id::text,
        to_jsonb(v_line.prev_purchase_price)
      );
    END IF;
  END LOOP;

  DELETE FROM public.transaction_payments WHERE transaction_id = _id;
  DELETE FROM public.transaction_purchase_lines WHERE transaction_id = _id;
  DELETE FROM public.transactions WHERE id = _id;

  FOR v_key IN SELECT jsonb_object_keys(v_prev_map) LOOP
    v_var := v_key::uuid;
    SELECT COALESCE(NULLIF(pack_size, 0), 1), product_id INTO v_pack, v_prod
      FROM public.variations WHERE id = v_var;
    IF v_pack IS NULL THEN CONTINUE; END IF;

    -- Prefer the latest remaining purchase for this item
    SELECT l.purchase_price INTO v_prev
      FROM public.transaction_purchase_lines l
      JOIN public.transactions t ON t.id = l.transaction_id
      WHERE l.variation_id = v_var AND t.type = 'purchase'
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 1;

    -- Otherwise fall back to the cost snapshot taken before the deleted purchase
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
$$;