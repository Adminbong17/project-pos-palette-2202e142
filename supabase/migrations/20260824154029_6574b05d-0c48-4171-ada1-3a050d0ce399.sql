ALTER TABLE public.stock_transfers DROP CONSTRAINT stock_transfers_created_by_fkey;
ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.accounts DROP CONSTRAINT accounts_created_by_fkey;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.account_transactions DROP CONSTRAINT account_transactions_created_by_fkey;
ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;