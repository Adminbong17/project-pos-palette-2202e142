CREATE TABLE public.clinic_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'service',
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_services TO authenticated;
GRANT ALL ON public.clinic_services TO service_role;
ALTER TABLE public.clinic_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage clinic services" ON public.clinic_services
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER clinic_services_updated_at BEFORE UPDATE ON public.clinic_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.clinic_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_no text,
  sale_date timestamptz NOT NULL DEFAULT now(),
  patient_name text,
  patient_phone text,
  doctor_id uuid,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_sales TO authenticated;
GRANT ALL ON public.clinic_sales TO service_role;
ALTER TABLE public.clinic_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage clinic sales" ON public.clinic_sales
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER clinic_sales_updated_at BEFORE UPDATE ON public.clinic_sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.clinic_sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.clinic_sales(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.clinic_services(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_sale_lines TO authenticated;
GRANT ALL ON public.clinic_sale_lines TO service_role;
ALTER TABLE public.clinic_sale_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage clinic sale lines" ON public.clinic_sale_lines
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE INDEX idx_clinic_services_business ON public.clinic_services(business_id);
CREATE INDEX idx_clinic_sales_business_date ON public.clinic_sales(business_id, sale_date DESC);
CREATE INDEX idx_clinic_sale_lines_sale ON public.clinic_sale_lines(sale_id);