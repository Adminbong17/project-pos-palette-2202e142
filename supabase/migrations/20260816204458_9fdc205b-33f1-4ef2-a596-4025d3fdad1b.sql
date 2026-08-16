CREATE TYPE public.rx_billing_mode AS ENUM ('credit','subscription','free');

CREATE TABLE public.rx_billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  mode public.rx_billing_mode NOT NULL DEFAULT 'credit',
  credits integer NOT NULL DEFAULT 0,
  phone text,
  phone_verified_at timestamptz,
  payment_link text,
  helpline text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rx_billing_accounts_business_pool_key ON public.rx_billing_accounts (business_id) WHERE user_id IS NULL;
CREATE UNIQUE INDEX rx_billing_accounts_user_key ON public.rx_billing_accounts (business_id, user_id) WHERE user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_billing_accounts TO authenticated;
GRANT ALL ON public.rx_billing_accounts TO service_role;
ALTER TABLE public.rx_billing_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin manages billing accounts" ON public.rx_billing_accounts
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "business admins manage their billing accounts" ON public.rx_billing_accounts
  FOR ALL TO authenticated USING (public.is_business_admin(auth.uid(), business_id)) WITH CHECK (public.is_business_admin(auth.uid(), business_id));
CREATE POLICY "members read own billing account" ON public.rx_billing_accounts
  FOR SELECT TO authenticated USING (public.is_business_member(auth.uid(), business_id));

CREATE TABLE public.rx_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.rx_billing_accounts(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rx_credit_ledger TO authenticated;
GRANT ALL ON public.rx_credit_ledger TO service_role;
ALTER TABLE public.rx_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read credit ledger of own business" ON public.rx_credit_ledger
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.rx_billing_accounts a
    WHERE a.id = account_id AND (public.is_super_admin(auth.uid()) OR public.is_business_member(auth.uid(), a.business_id))));
CREATE POLICY "admins write credit ledger" ON public.rx_credit_ledger
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.rx_billing_accounts a
    WHERE a.id = account_id AND (public.is_super_admin(auth.uid()) OR public.is_business_admin(auth.uid(), a.business_id))));

CREATE TABLE public.rx_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  period_start date NOT NULL,
  prescriptions_count integer NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  payment_link text,
  due_date date NOT NULL,
  sms_sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rx_bills_period_key ON public.rx_bills (business_id, user_id, period_start) NULLS NOT DISTINCT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_bills TO authenticated;
GRANT ALL ON public.rx_bills TO service_role;
ALTER TABLE public.rx_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages bills" ON public.rx_bills
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "business admins manage own bills" ON public.rx_bills
  FOR ALL TO authenticated USING (public.is_business_admin(auth.uid(), business_id)) WITH CHECK (public.is_business_admin(auth.uid(), business_id));
CREATE POLICY "members read own bills" ON public.rx_bills
  FOR SELECT TO authenticated USING (public.is_business_member(auth.uid(), business_id));

CREATE TABLE public.rx_phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rx_phone_otps TO authenticated;
GRANT ALL ON public.rx_phone_otps TO service_role;
ALTER TABLE public.rx_phone_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own otps" ON public.rx_phone_otps
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_rx_billing_accounts_updated_at BEFORE UPDATE ON public.rx_billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_rx_bills_updated_at BEFORE UPDATE ON public.rx_bills
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.rx_tier_amount(_count integer)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _count IS NULL OR _count <= 0 THEN 0::numeric
    WHEN _count <= 100 THEN _count * 5::numeric
    WHEN _count <= 200 THEN _count * 4::numeric
    ELSE _count * 3::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.rx_resolve_account(_business_id uuid, _user_id uuid)
RETURNS public.rx_billing_accounts LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.rx_billing_accounts
  WHERE business_id = _business_id AND (user_id = _user_id OR user_id IS NULL)
  ORDER BY (user_id IS NULL)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.rx_billing_state(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    'shared_pool', (_acc.id IS NOT NULL AND _acc.user_id IS NULL),
    'phone', _acc.phone,
    'phone_verified', _acc.phone_verified_at IS NOT NULL,
    'payment_link', COALESCE(_overdue.payment_link, _acc.payment_link),
    'helpline', COALESCE(_acc.helpline, '01712472839'),
    'month_count', _count,
    'month_amount', public.rx_tier_amount(_count),
    'locked', (COALESCE(_acc.mode::text, 'credit') <> 'free' AND _overdue.id IS NOT NULL),
    'overdue_bill', CASE WHEN _overdue.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', _overdue.id, 'period_start', _overdue.period_start, 'amount', _overdue.amount,
      'due_date', _overdue.due_date, 'count', _overdue.prescriptions_count) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rx_charge_prescription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _acc public.rx_billing_accounts;
  _state jsonb;
BEGIN
  IF NEW.created_by IS NULL OR NEW.business_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _acc FROM public.rx_resolve_account(NEW.business_id, NEW.created_by);
  IF _acc.id IS NULL OR _acc.mode = 'free' THEN RETURN NEW; END IF;

  _state := public.rx_billing_state(NEW.created_by);
  IF COALESCE((_state->>'locked')::boolean, false) THEN
    RAISE EXCEPTION 'Prescription billing is locked: an overdue bill must be paid. Helpline %', _state->>'helpline';
  END IF;

  IF _acc.mode = 'credit' THEN
    IF _acc.credits <= 0 THEN
      RAISE EXCEPTION 'No prescription credits left. Please contact the admin (helpline %)', COALESCE(_acc.helpline, '01712472839');
    END IF;
    UPDATE public.rx_billing_accounts SET credits = credits - 1 WHERE id = _acc.id;
    INSERT INTO public.rx_credit_ledger (account_id, delta, reason, created_by)
      VALUES (_acc.id, -1, 'prescription', NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rx_charge_prescription BEFORE INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.rx_charge_prescription();

CREATE OR REPLACE FUNCTION public.rx_grant_credits(_account_id uuid, _delta integer, _reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bid uuid; _left integer;
BEGIN
  SELECT business_id INTO _bid FROM public.rx_billing_accounts WHERE id = _account_id;
  IF _bid IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_business_admin(auth.uid(), _bid)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.rx_billing_accounts SET credits = GREATEST(0, credits + _delta)
    WHERE id = _account_id RETURNING credits INTO _left;
  INSERT INTO public.rx_credit_ledger (account_id, delta, reason, created_by)
    VALUES (_account_id, _delta, COALESCE(_reason, 'admin adjustment'), auth.uid());
  RETURN _left;
END;
$$;

CREATE OR REPLACE FUNCTION public.rx_close_month(_month date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _m date := COALESCE(date_trunc('month', _month)::date,
                      (date_trunc('month', (now() AT TIME ZONE 'Asia/Dhaka')) - interval '1 month')::date);
  _made integer := 0;
  r record;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  FOR r IN
    SELECT a.id, a.business_id, a.user_id, a.payment_link,
      (SELECT count(*) FROM public.prescriptions p
        WHERE p.business_id = a.business_id
          AND (a.user_id IS NULL OR p.created_by = a.user_id)
          AND (p.created_at AT TIME ZONE 'Asia/Dhaka')::date >= _m
          AND (p.created_at AT TIME ZONE 'Asia/Dhaka')::date < (_m + interval '1 month')::date) AS cnt
    FROM public.rx_billing_accounts a WHERE a.mode = 'subscription'
  LOOP
    IF r.cnt > 0 THEN
      INSERT INTO public.rx_bills (business_id, user_id, period_start, prescriptions_count, amount, payment_link, due_date)
      VALUES (r.business_id, r.user_id, _m, r.cnt, public.rx_tier_amount(r.cnt::integer), r.payment_link,
              (_m + interval '1 month' + interval '4 days')::date)
      ON CONFLICT (business_id, user_id, period_start) DO UPDATE
        SET prescriptions_count = EXCLUDED.prescriptions_count,
            amount = EXCLUDED.amount,
            payment_link = COALESCE(public.rx_bills.payment_link, EXCLUDED.payment_link);
      _made := _made + 1;
    END IF;
  END LOOP;
  RETURN _made;
END;
$$;