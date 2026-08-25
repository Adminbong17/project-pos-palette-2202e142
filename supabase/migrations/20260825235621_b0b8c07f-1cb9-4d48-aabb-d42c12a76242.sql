CREATE OR REPLACE FUNCTION pg_temp.qweek_apply_user_fk(_table regclass, _column text, _action text, _constraint text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _attnum smallint;
  _existing record;
BEGIN
  SELECT attnum INTO _attnum
  FROM pg_attribute
  WHERE attrelid = _table
    AND attname = _column
    AND NOT attisdropped;

  IF _attnum IS NULL THEN
    RETURN;
  END IF;

  IF upper(_action) = 'CASCADE' THEN
    EXECUTE format(
      'DELETE FROM %s t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I)',
      _table,
      _column,
      _column
    );
  ELSE
    EXECUTE format(
      'UPDATE %s t SET %I = NULL WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I)',
      _table,
      _column,
      _column,
      _column
    );
  END IF;

  FOR _existing IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = _table
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND _attnum = ANY(c.conkey)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', _table, _existing.conname);
  END LOOP;

  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
    _table,
    _constraint,
    _column,
    upper(_action)
  );
END;
$$;

-- Remove deleted users from current access/account surfaces.
SELECT pg_temp.qweek_apply_user_fk('public.business_users'::regclass, 'user_id', 'CASCADE', 'business_users_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.user_roles'::regclass, 'user_id', 'CASCADE', 'user_roles_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_staff'::regclass, 'user_id', 'CASCADE', 'rx_staff_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_staff'::regclass, 'doctor_id', 'CASCADE', 'rx_staff_doctor_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.access_requests'::regclass, 'user_id', 'CASCADE', 'access_requests_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.business_requests'::regclass, 'user_id', 'CASCADE', 'business_requests_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_user_option_settings'::regclass, 'user_id', 'CASCADE', 'rx_user_option_settings_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_presets'::regclass, 'user_id', 'CASCADE', 'rx_presets_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_phone_otps'::regclass, 'user_id', 'CASCADE', 'rx_phone_otps_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_billing_accounts'::regclass, 'user_id', 'CASCADE', 'rx_billing_accounts_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_bills'::regclass, 'user_id', 'CASCADE', 'rx_bills_user_id_fkey');

-- Keep business history but detach deleted-user identity references.
SELECT pg_temp.qweek_apply_user_fk('public.access_requests'::regclass, 'reviewed_by', 'SET NULL', 'access_requests_reviewed_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.business_requests'::regclass, 'reviewed_by', 'SET NULL', 'business_requests_reviewed_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_appointments'::regclass, 'doctor_id', 'SET NULL', 'rx_appointments_doctor_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_credit_links'::regclass, 'user_id', 'SET NULL', 'rx_credit_links_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_credit_links'::regclass, 'created_by', 'SET NULL', 'rx_credit_links_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_credit_orders'::regclass, 'user_id', 'SET NULL', 'rx_credit_orders_user_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_credit_orders'::regclass, 'approved_by', 'SET NULL', 'rx_credit_orders_approved_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_credit_ledger'::regclass, 'created_by', 'SET NULL', 'rx_credit_ledger_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.rx_chambers'::regclass, 'created_by', 'SET NULL', 'rx_chambers_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.prescriptions'::regclass, 'created_by', 'SET NULL', 'prescriptions_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.prescriptions'::regclass, 'doctor_id', 'SET NULL', 'prescriptions_doctor_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.clinic_sales'::regclass, 'created_by', 'SET NULL', 'clinic_sales_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.clinic_sales'::regclass, 'doctor_id', 'SET NULL', 'clinic_sales_doctor_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.clinic_treatment_plans'::regclass, 'created_by', 'SET NULL', 'clinic_treatment_plans_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.clinic_treatment_plans'::regclass, 'doctor_id', 'SET NULL', 'clinic_treatment_plans_doctor_id_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.clinic_plan_payments'::regclass, 'created_by', 'SET NULL', 'clinic_plan_payments_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.clinic_services'::regclass, 'created_by', 'SET NULL', 'clinic_services_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.sms_settings'::regclass, 'updated_by', 'SET NULL', 'sms_settings_updated_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.products'::regclass, 'created_by', 'SET NULL', 'products_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.contacts'::regclass, 'created_by', 'SET NULL', 'contacts_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.stock_adjustments'::regclass, 'created_by', 'SET NULL', 'stock_adjustments_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.stock_transfers'::regclass, 'created_by', 'SET NULL', 'stock_transfers_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.accounts'::regclass, 'created_by', 'SET NULL', 'accounts_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.account_transactions'::regclass, 'created_by', 'SET NULL', 'account_transactions_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.expense_categories'::regclass, 'created_by', 'SET NULL', 'expense_categories_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.expenses'::regclass, 'created_by', 'SET NULL', 'expenses_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.expense_payments'::regclass, 'created_by', 'SET NULL', 'expense_payments_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.mfg_boms'::regclass, 'created_by', 'SET NULL', 'mfg_boms_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.mfg_production_orders'::regclass, 'created_by', 'SET NULL', 'mfg_production_orders_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.attachments'::regclass, 'created_by', 'SET NULL', 'attachments_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.transaction_payments'::regclass, 'created_by', 'SET NULL', 'transaction_payments_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.transactions'::regclass, 'created_by', 'SET NULL', 'transactions_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.transactions'::regclass, 'deleted_by', 'SET NULL', 'transactions_deleted_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.chief_complaints'::regclass, 'created_by', 'SET NULL', 'chief_complaints_created_by_fkey');
SELECT pg_temp.qweek_apply_user_fk('public.investigations'::regclass, 'created_by', 'SET NULL', 'investigations_created_by_fkey');

-- Clear current-business pointers that no longer point to an active membership.
UPDATE public.profiles p
SET current_business_id = NULL
WHERE current_business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_users bu
    WHERE bu.user_id = p.id
      AND bu.business_id = p.current_business_id
      AND bu.is_active = true
  );