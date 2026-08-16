CREATE SCHEMA IF NOT EXISTS backups;
REVOKE ALL ON SCHEMA backups FROM anon, authenticated;

DROP TABLE IF EXISTS backups.products_20260816;
DROP TABLE IF EXISTS backups.variations_20260816;
DROP TABLE IF EXISTS backups.variation_location_details_20260816;
DROP TABLE IF EXISTS backups.transactions_20260816;
DROP TABLE IF EXISTS backups.transaction_purchase_lines_20260816;
DROP TABLE IF EXISTS backups.transaction_sell_lines_20260816;
DROP TABLE IF EXISTS backups.transaction_payments_20260816;
DROP TABLE IF EXISTS backups.contacts_20260816;
DROP TABLE IF EXISTS backups.prescriptions_20260816;
DROP TABLE IF EXISTS backups.prescription_lines_20260816;

CREATE TABLE backups.products_20260816 AS SELECT * FROM public.products;
CREATE TABLE backups.variations_20260816 AS SELECT * FROM public.variations;
CREATE TABLE backups.variation_location_details_20260816 AS SELECT * FROM public.variation_location_details;
CREATE TABLE backups.transactions_20260816 AS SELECT * FROM public.transactions;
CREATE TABLE backups.transaction_purchase_lines_20260816 AS SELECT * FROM public.transaction_purchase_lines;
CREATE TABLE backups.transaction_sell_lines_20260816 AS SELECT * FROM public.transaction_sell_lines;
CREATE TABLE backups.transaction_payments_20260816 AS SELECT * FROM public.transaction_payments;
CREATE TABLE backups.contacts_20260816 AS SELECT * FROM public.contacts;
CREATE TABLE backups.prescriptions_20260816 AS SELECT * FROM public.prescriptions;
CREATE TABLE backups.prescription_lines_20260816 AS SELECT * FROM public.prescription_lines;