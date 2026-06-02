-- GridPilot: charging address fields on marketplace_qualification
-- Run after gridpilot_supabase_schema_marketplace_qualification.sql

alter table public.marketplace_qualification
  add column if not exists address_line1 text;
alter table public.marketplace_qualification
  add column if not exists address_line2 text;
alter table public.marketplace_qualification
  add column if not exists city text;
