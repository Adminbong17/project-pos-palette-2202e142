ALTER TABLE public.rx_staff
  ADD CONSTRAINT rx_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT rx_staff_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.access_requests
  ADD CONSTRAINT access_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.business_requests
  ADD CONSTRAINT business_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.rx_user_option_settings
  ADD CONSTRAINT rx_user_option_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.rx_presets
  ADD CONSTRAINT rx_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.rx_appointments
  ADD CONSTRAINT rx_appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.rx_billing_accounts
  ADD CONSTRAINT rx_billing_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.rx_credit_links
  ADD CONSTRAINT rx_credit_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;