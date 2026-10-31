-- Fix appointment serial numbering to scope by doctor_id and business_id for the appointment date
CREATE OR REPLACE FUNCTION public.tg_rx_appointment_serial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.serial_no IS NULL THEN
    IF NEW.doctor_id IS NOT NULL THEN
      SELECT COALESCE(MAX(serial_no), 0) + 1 INTO NEW.serial_no
      FROM public.rx_appointments
      WHERE business_id = NEW.business_id
        AND appt_date = NEW.appt_date
        AND doctor_id = NEW.doctor_id;
    ELSE
      SELECT COALESCE(MAX(serial_no), 0) + 1 INTO NEW.serial_no
      FROM public.rx_appointments
      WHERE business_id = NEW.business_id
        AND appt_date = NEW.appt_date
        AND chamber_id IS NOT DISTINCT FROM NEW.chamber_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Support multiple assigned chambers for staff
ALTER TABLE public.rx_staff ADD COLUMN IF NOT EXISTS chamber_ids uuid[];
