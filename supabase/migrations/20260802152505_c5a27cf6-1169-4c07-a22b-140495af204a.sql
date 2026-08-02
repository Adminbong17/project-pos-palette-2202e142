CREATE TABLE public.rx_chambers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_chambers TO authenticated;
GRANT ALL ON public.rx_chambers TO service_role;
ALTER TABLE public.rx_chambers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage chambers" ON public.rx_chambers FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER trg_rx_chambers_updated BEFORE UPDATE ON public.rx_chambers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.rx_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  chamber_id uuid REFERENCES public.rx_chambers(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_age text,
  patient_phone text,
  patient_gender text,
  appt_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  appt_time time,
  serial_no integer,
  status text NOT NULL DEFAULT 'waiting',
  notes text,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rx_appointments TO authenticated;
GRANT ALL ON public.rx_appointments TO service_role;
ALTER TABLE public.rx_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage appointments" ON public.rx_appointments FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER trg_rx_appointments_updated BEFORE UPDATE ON public.rx_appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_rx_appointments_lookup ON public.rx_appointments (business_id, appt_date, chamber_id, serial_no);

CREATE OR REPLACE FUNCTION public.tg_rx_appointment_serial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.serial_no IS NULL THEN
    SELECT COALESCE(MAX(serial_no), 0) + 1 INTO NEW.serial_no
    FROM public.rx_appointments
    WHERE business_id = NEW.business_id
      AND appt_date = NEW.appt_date
      AND chamber_id IS NOT DISTINCT FROM NEW.chamber_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rx_appointments_serial BEFORE INSERT ON public.rx_appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_rx_appointment_serial();