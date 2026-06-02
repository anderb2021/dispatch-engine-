-- GridPilot / EBON Schema add-on: Telemetry polling + Flexibility analytics
-- Run this in the Supabase SQL Editor AFTER gridpilot_supabase_schema_v1.sql.
--
-- This migration is additive and idempotent. It does NOT drop or rename anything.
-- It extends vehicle_snapshots and creates daily_flexibility_summaries.
-- To fully remove this feature, drop daily_flexibility_summaries and the two
-- added vehicle_snapshots columns (provider, vehicle_online).

-- =========================================
-- EXTEND vehicle_snapshots
-- We reuse the existing telemetry table rather than duplicating it.
-- =========================================

alter table public.vehicle_snapshots
  add column if not exists provider text not null default 'tesla';

-- vehicle_online captures whether Tesla returned live data (true) or the car
-- was asleep/offline (false). Lets us track availability without route history.
alter table public.vehicle_snapshots
  add column if not exists vehicle_online boolean;

-- =========================================
-- DAILY FLEXIBILITY SUMMARIES
-- One row per vehicle per day. Aggregated from vehicle_snapshots.
-- Privacy note: charging_location_lat/lon are only stored for plugged-in /
-- charging windows and are intended ONLY for utility / PJM eligibility and
-- marketplace qualification — never for normal user-facing dashboards.
-- =========================================

create table if not exists public.daily_flexibility_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  summary_date date not null, -- UTC calendar date of the aggregation window

  first_seen_at timestamptz,
  last_seen_at timestamptz,
  plug_in_time timestamptz,
  unplug_time timestamptz,

  total_plugged_minutes numeric(10,2) not null default 0,
  total_charging_minutes numeric(10,2) not null default 0,
  idle_plugged_minutes numeric(10,2) not null default 0,

  avg_charger_power_kw numeric(8,2) not null default 0,
  estimated_energy_delivered_kwh numeric(12,3) not null default 0,
  estimated_flexible_kwh numeric(12,3) not null default 0,

  -- Precise coordinates only retained for grid/marketplace qualification.
  charging_location_lat numeric(10,7),
  charging_location_lon numeric(10,7),
  charging_location_type text, -- e.g. 'primary' | null (classification is future work)

  flexibility_score numeric(5,2) not null default 0,   -- 0..100 rule-based MVP
  dispatch_confidence numeric(6,4) not null default 0,  -- 0..1 conservative MVP

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (vehicle_id, summary_date)
);

create index if not exists idx_daily_flex_user_date
  on public.daily_flexibility_summaries(user_id, summary_date desc);
create index if not exists idx_daily_flex_vehicle_date
  on public.daily_flexibility_summaries(vehicle_id, summary_date desc);

-- keep updated_at fresh (reuses the v1 helper function public.set_updated_at)
drop trigger if exists set_daily_flex_updated_at on public.daily_flexibility_summaries;
create trigger set_daily_flex_updated_at
before update on public.daily_flexibility_summaries
for each row execute procedure public.set_updated_at();

-- =========================================
-- RLS
-- Backend service role bypasses RLS. Authenticated users can read their own
-- rows; admins can read all (matches the v1 pattern for participant tables).
-- =========================================

alter table public.daily_flexibility_summaries enable row level security;

drop policy if exists "Users can view own flexibility summaries" on public.daily_flexibility_summaries;
create policy "Users can view own flexibility summaries"
on public.daily_flexibility_summaries for select
to authenticated
using (user_id = auth.uid() or public.is_admin());
