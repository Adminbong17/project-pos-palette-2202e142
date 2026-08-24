CREATE TABLE public.rx_credit_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  label text,
  rate_per_credit numeric NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rx_credit_links TO authenticated;
GRANT ALL ON public.rx_credit_links TO service_role;
ALTER TABLE public.rx_credit_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages credit links" ON public.rx_credit_links
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members read their credit links" ON public.rx_credit_links
  FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

CREATE TABLE public.rx_credit_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid REFERENCES public.rx_credit_links(id) ON DELETE SET NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  rate_per_credit numeric NOT NULL DEFAULT 3,
  method text NOT NULL DEFAULT 'bkash',
  payer_name text,
  payer_phone text,
  txn_ref text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  approved_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rx_credit_orders TO authenticated;
GRANT ALL ON public.rx_credit_orders TO service_role;
ALTER TABLE public.rx_credit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages credit orders" ON public.rx_credit_orders
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members read their credit orders" ON public.rx_credit_orders
  FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

CREATE INDEX rx_credit_orders_business_idx ON public.rx_credit_orders (business_id, created_at DESC);
CREATE INDEX rx_credit_orders_status_idx ON public.rx_credit_orders (status);

CREATE TRIGGER rx_credit_links_updated_at BEFORE UPDATE ON public.rx_credit_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER rx_credit_orders_updated_at BEFORE UPDATE ON public.rx_credit_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();