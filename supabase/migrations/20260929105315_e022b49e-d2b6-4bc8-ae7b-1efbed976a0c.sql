CREATE TABLE public.archive_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  grp text NOT NULL,
  period_month date NOT NULL,
  vault_file_id text,
  share_token text,
  file_name text,
  row_count integer NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  key_index jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'archived',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, grp, period_month)
);
GRANT SELECT ON public.archive_chunks TO authenticated;
GRANT ALL ON public.archive_chunks TO service_role;
ALTER TABLE public.archive_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own archive index" ON public.archive_chunks
  FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER archive_chunks_updated BEFORE UPDATE ON public.archive_chunks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- months (per business, per group) older than cutoff that still have live rows
CREATE OR REPLACE FUNCTION public.archive_candidates(_cutoff date)
RETURNS TABLE(business_id uuid, grp text, period_month date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT t.business_id, 'sales', date_trunc('month', t.transaction_date)::date FROM transactions t WHERE t.transaction_date < _cutoff
  UNION SELECT DISTINCT p.business_id, 'prescriptions', date_trunc('month', p.rx_date)::date FROM prescriptions p WHERE p.rx_date < _cutoff
  UNION SELECT DISTINCT l.business_id, 'lab_reports', date_trunc('month', l.created_at)::date FROM lab_reports l WHERE l.created_at < _cutoff
  UNION SELECT DISTINCT a.business_id, 'appointments', date_trunc('month', a.appt_date)::date FROM rx_appointments a WHERE a.appt_date < _cutoff
  UNION SELECT DISTINCT e.business_id, 'expenses', date_trunc('month', e.expense_date)::date FROM expenses e WHERE e.expense_date < _cutoff
$$;

CREATE OR REPLACE FUNCTION public.archive_collect(_business_id uuid, _grp text, _month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month')::date; r jsonb;
BEGIN
  IF _grp = 'sales' THEN
    SELECT jsonb_build_object(
      'transactions', coalesce(jsonb_agg(to_jsonb(t)), '[]'),
      'transaction_sell_lines', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM transaction_sell_lines x WHERE x.transaction_id IN (SELECT id FROM transactions WHERE business_id=_business_id AND transaction_date>=s AND transaction_date<e)),
      'transaction_purchase_lines', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM transaction_purchase_lines x WHERE x.transaction_id IN (SELECT id FROM transactions WHERE business_id=_business_id AND transaction_date>=s AND transaction_date<e)),
      'transaction_payments', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM transaction_payments x WHERE x.transaction_id IN (SELECT id FROM transactions WHERE business_id=_business_id AND transaction_date>=s AND transaction_date<e)))
    INTO r FROM transactions t WHERE t.business_id=_business_id AND t.transaction_date>=s AND t.transaction_date<e;
  ELSIF _grp = 'prescriptions' THEN
    SELECT jsonb_build_object('prescriptions', coalesce(jsonb_agg(to_jsonb(p)), '[]'),
      'prescription_lines', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM prescription_lines x WHERE x.prescription_id IN (SELECT id FROM prescriptions WHERE business_id=_business_id AND rx_date>=s AND rx_date<e)))
    INTO r FROM prescriptions p WHERE p.business_id=_business_id AND p.rx_date>=s AND p.rx_date<e;
  ELSIF _grp = 'lab_reports' THEN
    SELECT jsonb_build_object('lab_reports', coalesce(jsonb_agg(to_jsonb(l)), '[]')) INTO r FROM lab_reports l WHERE l.business_id=_business_id AND l.created_at>=s AND l.created_at<e;
  ELSIF _grp = 'appointments' THEN
    SELECT jsonb_build_object('rx_appointments', coalesce(jsonb_agg(to_jsonb(a)), '[]')) INTO r FROM rx_appointments a WHERE a.business_id=_business_id AND a.appt_date>=s AND a.appt_date<e;
  ELSIF _grp = 'expenses' THEN
    SELECT jsonb_build_object('expenses', coalesce(jsonb_agg(to_jsonb(x)), '[]'),
      'expense_payments', (SELECT coalesce(jsonb_agg(to_jsonb(y)), '[]') FROM expense_payments y WHERE y.expense_id IN (SELECT id FROM expenses WHERE business_id=_business_id AND expense_date>=s AND expense_date<e)))
    INTO r FROM expenses x WHERE x.business_id=_business_id AND x.expense_date>=s AND x.expense_date<e;
  ELSE RAISE EXCEPTION 'unknown group %', _grp; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.archive_delete(_business_id uuid, _grp text, _month date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month')::date; n integer;
BEGIN
  IF _grp = 'sales' THEN DELETE FROM transactions WHERE business_id=_business_id AND transaction_date>=s AND transaction_date<e;
  ELSIF _grp = 'prescriptions' THEN DELETE FROM prescriptions WHERE business_id=_business_id AND rx_date>=s AND rx_date<e;
  ELSIF _grp = 'lab_reports' THEN DELETE FROM lab_reports WHERE business_id=_business_id AND created_at>=s AND created_at<e;
  ELSIF _grp = 'appointments' THEN DELETE FROM rx_appointments WHERE business_id=_business_id AND appt_date>=s AND appt_date<e;
  ELSIF _grp = 'expenses' THEN DELETE FROM expenses WHERE business_id=_business_id AND expense_date>=s AND expense_date<e;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.archive_restore(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tbl text; out jsonb := '{}'; n integer;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['transactions','transaction_sell_lines','transaction_purchase_lines','transaction_payments','prescriptions','prescription_lines','lab_reports','rx_appointments','expenses','expense_payments'] LOOP
    IF _payload ? tbl AND jsonb_array_length(_payload->tbl) > 0 THEN
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (id) DO NOTHING', tbl, tbl) USING _payload->tbl;
      GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object(tbl, n);
    END IF;
  END LOOP;
  UPDATE prescriptions p SET transaction_id = NULL WHERE p.transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=p.transaction_id);
  RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.archive_candidates(date), public.archive_collect(uuid,text,date), public.archive_delete(uuid,text,date), public.archive_restore(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_candidates(date), public.archive_collect(uuid,text,date), public.archive_delete(uuid,text,date), public.archive_restore(jsonb) TO service_role;