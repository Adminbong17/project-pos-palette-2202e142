ALTER TABLE public.rx_billing_accounts
  ADD COLUMN IF NOT EXISTS credit_rate numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS monthly_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.rx_billing_state(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bid uuid;
  _acc public.rx_billing_accounts;
  _month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Dhaka'))::date;
  _count integer := 0;
  _overdue public.rx_bills;
BEGIN
  SELECT business_id INTO _bid FROM public.business_users
    WHERE user_id = _user_id AND is_active = true LIMIT 1;
  IF _bid IS NULL THEN RETURN jsonb_build_object('locked', false, 'mode', 'free'); END IF;

  SELECT * INTO _acc FROM public.rx_resolve_account(_bid, _user_id);

  SELECT count(*) INTO _count FROM public.prescriptions
    WHERE business_id = _bid AND created_by = _user_id
      AND (created_at AT TIME ZONE 'Asia/Dhaka')::date >= _month;

  SELECT * INTO _overdue FROM public.rx_bills
    WHERE business_id = _bid AND (user_id = _user_id OR user_id IS NULL)
      AND status = 'unpaid' AND due_date < (now() AT TIME ZONE 'Asia/Dhaka')::date
    ORDER BY due_date LIMIT 1;

  RETURN jsonb_build_object(
    'business_id', _bid,
    'account_id', _acc.id,
    'mode', COALESCE(_acc.mode::text, 'credit'),
    'credits', COALESCE(_acc.credits, 0),
    'credit_rate', COALESCE(_acc.credit_rate, 3),
    'monthly_amount', COALESCE(_acc.monthly_amount, 0),
    'shared_pool', (_acc.id IS NOT NULL AND _acc.user_id IS NULL),
    'phone', _acc.phone,
    'phone_verified', _acc.phone_verified_at IS NOT NULL,
    'payment_link', COALESCE(_overdue.payment_link, _acc.payment_link),
    'helpline', COALESCE(_acc.helpline, '01712472839'),
    'month_count', _count,
    'month_amount', CASE WHEN COALESCE(_acc.mode::text, 'credit') = 'subscription'
                         THEN COALESCE(_acc.monthly_amount, 0)
                         ELSE public.rx_tier_amount(_count) END,
    'locked', (COALESCE(_acc.mode::text, 'credit') <> 'free' AND _overdue.id IS NOT NULL),
    'overdue_bill', CASE WHEN _overdue.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', _overdue.id, 'period_start', _overdue.period_start, 'amount', _overdue.amount,
      'due_date', _overdue.due_date, 'count', _overdue.prescriptions_count) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rx_close_month(_month date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _m date := COALESCE(date_trunc('month', _month)::date,
                      (date_trunc('month', (now() AT TIME ZONE 'Asia/Dhaka')) - interval '1 month')::date);
  _made integer := 0;
  _amt numeric;
  r record;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  FOR r IN
    SELECT a.id, a.business_id, a.user_id, a.payment_link, a.monthly_amount,
      (SELECT count(*) FROM public.prescriptions p
        WHERE p.business_id = a.business_id
          AND (a.user_id IS NULL OR p.created_by = a.user_id)
          AND (p.created_at AT TIME ZONE 'Asia/Dhaka')::date >= _m
          AND (p.created_at AT TIME ZONE 'Asia/Dhaka')::date < (_m + interval '1 month')::date) AS cnt
    FROM public.rx_billing_accounts a WHERE a.mode = 'subscription'
  LOOP
    _amt := CASE WHEN COALESCE(r.monthly_amount, 0) > 0
                 THEN r.monthly_amount
                 ELSE public.rx_tier_amount(r.cnt::integer) END;
    IF _amt > 0 THEN
      INSERT INTO public.rx_bills (business_id, user_id, period_start, prescriptions_count, amount, payment_link, due_date)
      VALUES (r.business_id, r.user_id, _m, r.cnt, _amt, r.payment_link,
              (_m + interval '1 month' + interval '7 days')::date)
      ON CONFLICT (business_id, user_id, period_start) DO UPDATE
        SET prescriptions_count = EXCLUDED.prescriptions_count,
            amount = EXCLUDED.amount,
            due_date = EXCLUDED.due_date,
            payment_link = COALESCE(public.rx_bills.payment_link, EXCLUDED.payment_link);
      _made := _made + 1;
    END IF;
  END LOOP;
  RETURN _made;
END;
$$;