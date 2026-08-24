ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS notify_phone text;

CREATE TABLE public.clinic_treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  doctor_id uuid,
  appointment_id uuid REFERENCES public.rx_appointments(id) ON DELETE SET NULL,
  patient_code text,
  patient_name text NOT NULL,
  patient_phone text,
  total_amount numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  installment_count integer NOT NULL DEFAULT 1,
  installment_interval_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_treatment_plans TO authenticated;
GRANT ALL ON public.clinic_treatment_plans TO service_role;
ALTER TABLE public.clinic_treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage treatment plans" ON public.clinic_treatment_plans FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clinic_treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.clinic_plan_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.clinic_treatment_plans(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.clinic_services(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_plan_lines TO authenticated;
GRANT ALL ON public.clinic_plan_lines TO service_role;
ALTER TABLE public.clinic_plan_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage plan lines" ON public.clinic_plan_lines FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TABLE public.clinic_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.clinic_treatment_plans(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_plan_installments TO authenticated;
GRANT ALL ON public.clinic_plan_installments TO service_role;
ALTER TABLE public.clinic_plan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage plan installments" ON public.clinic_plan_installments FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clinic_plan_installments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.clinic_plan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.clinic_treatment_plans(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.clinic_plan_installments(id) ON DELETE SET NULL,
  pay_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  note text,
  sms_sent_at timestamptz,
  sms_status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_plan_payments TO authenticated;
GRANT ALL ON public.clinic_plan_payments TO service_role;
ALTER TABLE public.clinic_plan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage plan payments" ON public.clinic_plan_payments FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE INDEX idx_plan_lines_plan ON public.clinic_plan_lines(plan_id);
CREATE INDEX idx_plan_inst_plan ON public.clinic_plan_installments(plan_id);
CREATE INDEX idx_plan_pay_plan ON public.clinic_plan_payments(plan_id);
CREATE INDEX idx_plans_business ON public.clinic_treatment_plans(business_id, start_date DESC);

-- Keep instalment paid amounts and plan status in sync with recorded payments.
CREATE OR REPLACE FUNCTION public.tg_clinic_plan_payment_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan uuid := COALESCE(NEW.plan_id, OLD.plan_id);
  _inst uuid := COALESCE(NEW.installment_id, OLD.installment_id);
  _total numeric;
  _paid numeric;
BEGIN
  IF _inst IS NOT NULL THEN
    UPDATE public.clinic_plan_installments i
      SET paid_amount = COALESCE((SELECT SUM(p.amount) FROM public.clinic_plan_payments p WHERE p.installment_id = i.id), 0),
          status = CASE
            WHEN COALESCE((SELECT SUM(p.amount) FROM public.clinic_plan_payments p WHERE p.installment_id = i.id), 0) >= i.amount THEN 'paid'
            WHEN COALESCE((SELECT SUM(p.amount) FROM public.clinic_plan_payments p WHERE p.installment_id = i.id), 0) > 0 THEN 'partial'
            ELSE 'pending' END
    WHERE i.id = _inst;
  END IF;

  SELECT (total_amount - discount) INTO _total FROM public.clinic_treatment_plans WHERE id = _plan;
  SELECT COALESCE(SUM(amount), 0) INTO _paid FROM public.clinic_plan_payments WHERE plan_id = _plan;
  UPDATE public.clinic_treatment_plans
    SET status = CASE WHEN _paid >= COALESCE(_total, 0) AND COALESCE(_total, 0) > 0 THEN 'completed' ELSE 'active' END
  WHERE id = _plan AND status <> 'cancelled';

  RETURN NULL;
END;
$$;

CREATE TRIGGER clinic_plan_payment_sync
AFTER INSERT OR UPDATE OR DELETE ON public.clinic_plan_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_clinic_plan_payment_sync();