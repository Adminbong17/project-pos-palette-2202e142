ALTER TABLE public.rx_credit_orders
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES public.rx_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rx_credit_orders_payment_id_idx ON public.rx_credit_orders (payment_id);