-- GridPilot: Marketplace qualification + Tesla location scope tracking
-- Run after gridpilot_supabase_schema_v1.sql and telemetry migration.

-- Extend tesla_connections with scope metadata
alter table public.tesla_connections
  add column if not exists granted_scopes text[];
alter table public.tesla_connections
  add column if not exists requested_scopes text[];
alter table public.tesla_connections
  add column if not exists vehicle_location_scope_granted boolean not null default false;
alter table public.tesla_connections
  add column if not exists location_scope_requested_at timestamptz;
alter table public.tesla_connections
  add column if not exists location_scope_granted_at timestamptz;
alter table public.tesla_connections
  add column if not exists last_scope_check_at timestamptz;

-- Backfill granted_scopes from legacy scopes column when present
update public.tesla_connections
set
  granted_scopes = scopes,
  vehicle_location_scope_granted = coalesce(
    'vehicle_location' = any(scopes),
    false
  ),
  last_scope_check_at = coalesce(last_scope_check_at, now())
where granted_scopes is null and scopes is not null;

create table if not exists public.marketplace_qualification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  zip_code text,
  utility_provider text,
  state text,
  iso_rto text not null default 'PJM',
  pjm_zone text,
  location_verification_method text,
  charging_location_lat numeric(10,7),
  charging_location_lon numeric(10,7),
  charging_location_verified boolean not null default false,
  utility_verified boolean not null default false,
  marketplace_eligible boolean not null default false,
  needs_location_scope boolean not null default false,
  eligibility_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_marketplace_qualification_user
  on public.marketplace_qualification(user_id);
create index if not exists idx_marketplace_qualification_eligible
  on public.marketplace_qualification(marketplace_eligible);

drop trigger if exists set_marketplace_qualification_updated_at on public.marketplace_qualification;
create trigger set_marketplace_qualification_updated_at
before update on public.marketplace_qualification
for each row execute procedure public.set_updated_at();

alter table public.marketplace_qualification enable row level security;

drop policy if exists "Users can manage own marketplace qualification" on public.marketplace_qualification;
create policy "Users can manage own marketplace qualification"
on public.marketplace_qualification for all
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
