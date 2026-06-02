-- GridPilot / EBON Supabase Schema v1
-- Run this in Supabase SQL Editor.
-- This creates the core database for:
-- users/profiles, Tesla connections, vehicle telemetry, behavior profiles,
-- flexibility events, buyer requests, settlements, support requests, and admin audit logs.

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================
-- ENUMS
-- =========================================

do $$ begin
  create type app_role as enum ('participant', 'buyer', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type connection_status as enum ('connected', 'disconnected', 'expired', 'revoked', 'error');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type dispatch_status as enum ('draft', 'scheduled', 'active', 'completed', 'verified', 'settled', 'cancelled', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type request_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception
  when duplicate_object then null;
end $$;

-- =========================================
-- PROFILES
-- Supabase auth.users is the identity source.
-- public.profiles stores app-specific user metadata.
-- =========================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role app_role not null default 'participant',
  phone text,
  region text,
  reward_balance numeric(12,2) not null default 0,
  lifetime_rewards numeric(12,2) not null default 0,
  flexibility_score numeric(5,2) not null default 0,
  dispatch_reliability numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile when Supabase Auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================================
-- TESLA CONNECTIONS
-- Store encrypted tokens from backend only.
-- Do NOT expose this table directly to frontend clients.
-- =========================================

create table if not exists public.tesla_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tesla_account_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  status connection_status not null default 'connected',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tesla_connections_user_id on public.tesla_connections(user_id);
create index if not exists idx_tesla_connections_status on public.tesla_connections(status);

-- =========================================
-- VEHICLES
-- =========================================

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tesla_connection_id uuid references public.tesla_connections(id) on delete set null,
  tesla_vehicle_id text not null,
  vin_last_6 text,
  display_name text,
  model text,
  state text,
  battery_capacity_kwh numeric(8,2),
  controllable_kw numeric(8,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tesla_vehicle_id)
);

create index if not exists idx_vehicles_user_id on public.vehicles(user_id);
create index if not exists idx_vehicles_tesla_vehicle_id on public.vehicles(tesla_vehicle_id);

-- =========================================
-- VEHICLE SNAPSHOTS / TELEMETRY
-- Append-only telemetry snapshots from Tesla polling.
-- =========================================

create table if not exists public.vehicle_snapshots (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  captured_at timestamptz not null default now(),

  battery_level numeric(5,2),
  charging_state text,
  plugged_in boolean,
  charge_limit_soc numeric(5,2),
  charger_power_kw numeric(8,2),
  charger_voltage numeric(8,2),
  charger_current numeric(8,2),
  time_to_full_charge_hours numeric(8,2),

  latitude numeric(10,7),
  longitude numeric(10,7),
  odometer numeric(12,2),

  raw_payload jsonb
);

create index if not exists idx_vehicle_snapshots_vehicle_time on public.vehicle_snapshots(vehicle_id, captured_at desc);
create index if not exists idx_vehicle_snapshots_user_time on public.vehicle_snapshots(user_id, captured_at desc);
create index if not exists idx_vehicle_snapshots_charging_state on public.vehicle_snapshots(charging_state);

-- =========================================
-- CHARGING SESSIONS
-- Derived from snapshots.
-- =========================================

create table if not exists public.charging_sessions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  start_soc numeric(5,2),
  end_soc numeric(5,2),
  energy_added_kwh numeric(10,3),
  duration_minutes integer,
  was_delayed_by_gridpilot boolean not null default false,
  user_override boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_charging_sessions_vehicle_time on public.charging_sessions(vehicle_id, started_at desc);
create index if not exists idx_charging_sessions_user_time on public.charging_sessions(user_id, started_at desc);

-- =========================================
-- BEHAVIOR PROFILES
-- Latest inferred behavior profile per vehicle.
-- =========================================

create table if not exists public.behavior_profiles (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,

  typical_arrival_time time,
  typical_departure_time time,
  average_daily_energy_kwh numeric(10,3),
  average_session_energy_kwh numeric(10,3),
  weekday_flexibility_hours numeric(8,2),
  weekend_flexibility_hours numeric(8,2),
  override_probability numeric(6,4),
  dispatch_confidence numeric(6,4),
  minimum_required_soc_estimate numeric(5,2),
  flexible_kwh_estimate numeric(10,3),
  model_version text not null default 'v1_rule_based',

  calculated_at timestamptz not null default now(),
  unique(vehicle_id)
);

create index if not exists idx_behavior_profiles_user_id on public.behavior_profiles(user_id);
create index if not exists idx_behavior_profiles_dispatch_confidence on public.behavior_profiles(dispatch_confidence desc);

-- =========================================
-- PARTICIPANT PREFERENCES
-- User-facing guardrails.
-- =========================================

create table if not exists public.participant_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  auto_flex_enabled boolean not null default true,
  manual_override_enabled boolean not null default true,
  reward_notifications_enabled boolean not null default true,
  minimum_battery_floor numeric(5,2) not null default 45,
  max_delay_hours numeric(5,2) not null default 4,
  payout_method text default 'manual',
  payout_destination_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- BUYERS
-- Flexibility buyers: utilities, aggregators, retail energy providers, etc.
-- =========================================

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  company_name text not null,
  buyer_type text,
  contact_email text,
  region text,
  status text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_buyers_profile_id on public.buyers(profile_id);

-- =========================================
-- DISPATCH REQUESTS
-- Buyer requests for flexibility.
-- =========================================

create table if not exists public.dispatch_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete set null,
  region text,
  requested_kw numeric(12,3) not null,
  max_price_per_kwh numeric(10,4) not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  status dispatch_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dispatch_requests_status on public.dispatch_requests(status);
create index if not exists idx_dispatch_requests_window on public.dispatch_requests(window_start, window_end);

-- =========================================
-- DISPATCH EVENTS
-- Actual or simulated dispatch against vehicles.
-- =========================================

create table if not exists public.dispatch_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_request_id uuid references public.dispatch_requests(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,

  event_type text not null default 'ev_charging_delay',
  status dispatch_status not null default 'scheduled',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,

  requested_delay_minutes integer,
  baseline_kwh numeric(12,3),
  actual_kwh numeric(12,3),
  verified_kwh_shifted numeric(12,3),
  delivered_kw numeric(12,3),
  estimated_grid_value numeric(12,2),
  user_reward numeric(12,2),
  buyer_charge numeric(12,2),

  user_override boolean not null default false,
  verification_method text not null default 'rule_based_mvp',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispatch_events_user_time on public.dispatch_events(user_id, scheduled_start desc);
create index if not exists idx_dispatch_events_request on public.dispatch_events(dispatch_request_id);
create index if not exists idx_dispatch_events_status on public.dispatch_events(status);

-- =========================================
-- REWARD LEDGER
-- User reward accounting.
-- =========================================

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dispatch_event_id uuid references public.dispatch_events(id) on delete set null,
  amount numeric(12,2) not null,
  description text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_reward_ledger_user_time on public.reward_ledger(user_id, created_at desc);
create index if not exists idx_reward_ledger_status on public.reward_ledger(status);

-- =========================================
-- SETTLEMENTS
-- Buyer-side accounting.
-- =========================================

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete set null,
  dispatch_request_id uuid references public.dispatch_requests(id) on delete set null,
  verified_kwh numeric(12,3) not null default 0,
  price_per_kwh numeric(10,4) not null default 0,
  gross_amount numeric(12,2) generated always as (round((verified_kwh * price_per_kwh)::numeric, 2)) stored,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists idx_settlements_buyer_time on public.settlements(buyer_id, created_at desc);
create index if not exists idx_settlements_status on public.settlements(status);

-- =========================================
-- SUPPORT REQUESTS
-- Participant/admin support and tracking.
-- =========================================

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  request_type text not null default 'support',
  title text not null,
  details text,
  status request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_support_requests_user_time on public.support_requests(user_id, created_at desc);
create index if not exists idx_support_requests_status on public.support_requests(status);

-- =========================================
-- AUDIT LOGS
-- Admin/security history.
-- =========================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_time on public.audit_logs(actor_user_id, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- =========================================
-- UPDATED_AT TRIGGER
-- =========================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_tesla_connections_updated_at on public.tesla_connections;
create trigger set_tesla_connections_updated_at
before update on public.tesla_connections
for each row execute procedure public.set_updated_at();

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at
before update on public.vehicles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_preferences_updated_at on public.participant_preferences;
create trigger set_preferences_updated_at
before update on public.participant_preferences
for each row execute procedure public.set_updated_at();

drop trigger if exists set_buyers_updated_at on public.buyers;
create trigger set_buyers_updated_at
before update on public.buyers
for each row execute procedure public.set_updated_at();

drop trigger if exists set_dispatch_requests_updated_at on public.dispatch_requests;
create trigger set_dispatch_requests_updated_at
before update on public.dispatch_requests
for each row execute procedure public.set_updated_at();

drop trigger if exists set_support_requests_updated_at on public.support_requests;
create trigger set_support_requests_updated_at
before update on public.support_requests
for each row execute procedure public.set_updated_at();

-- =========================================
-- RLS
-- Important:
-- Backend service role can bypass RLS for secure server-side operations.
-- Frontend authenticated users should only see their own participant data.
-- =========================================

alter table public.profiles enable row level security;
alter table public.tesla_connections enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_snapshots enable row level security;
alter table public.charging_sessions enable row level security;
alter table public.behavior_profiles enable row level security;
alter table public.participant_preferences enable row level security;
alter table public.buyers enable row level security;
alter table public.dispatch_requests enable row level security;
alter table public.dispatch_events enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.settlements enable row level security;
alter table public.support_requests enable row level security;
alter table public.audit_logs enable row level security;

-- Helper function for admin checks
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Participant-owned tables
drop policy if exists "Users can view own vehicles" on public.vehicles;
create policy "Users can view own vehicles"
on public.vehicles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own snapshots" on public.vehicle_snapshots;
create policy "Users can view own snapshots"
on public.vehicle_snapshots for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own charging sessions" on public.charging_sessions;
create policy "Users can view own charging sessions"
on public.charging_sessions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own behavior profiles" on public.behavior_profiles;
create policy "Users can view own behavior profiles"
on public.behavior_profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can manage own preferences" on public.participant_preferences;
create policy "Users can manage own preferences"
on public.participant_preferences for all
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own dispatch events" on public.dispatch_events;
create policy "Users can view own dispatch events"
on public.dispatch_events for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own rewards" on public.reward_ledger;
create policy "Users can view own rewards"
on public.reward_ledger for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can manage own support requests" on public.support_requests;
create policy "Users can manage own support requests"
on public.support_requests for all
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Hide Tesla token table from normal frontend users.
-- Admins can view connection metadata. Backend service role handles inserts/updates.
drop policy if exists "Admins can view tesla connections" on public.tesla_connections;
create policy "Admins can view tesla connections"
on public.tesla_connections for select
to authenticated
using (public.is_admin());

-- Buyer policies
drop policy if exists "Buyers can view own buyer record" on public.buyers;
create policy "Buyers can view own buyer record"
on public.buyers for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "Buyers can view own dispatch requests" on public.dispatch_requests;
create policy "Buyers can view own dispatch requests"
on public.dispatch_requests for select
to authenticated
using (
  public.is_admin()
  or buyer_id in (select id from public.buyers where profile_id = auth.uid())
);

drop policy if exists "Buyers can insert own dispatch requests" on public.dispatch_requests;
create policy "Buyers can insert own dispatch requests"
on public.dispatch_requests for insert
to authenticated
with check (
  buyer_id in (select id from public.buyers where profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Buyers can view own settlements" on public.settlements;
create policy "Buyers can view own settlements"
on public.settlements for select
to authenticated
using (
  public.is_admin()
  or buyer_id in (select id from public.buyers where profile_id = auth.uid())
);

-- Admin-only audit logs
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
on public.audit_logs for select
to authenticated
using (public.is_admin());

-- =========================================
-- VIEWS FOR DASHBOARDS
-- =========================================

create or replace view public.user_dashboard_summary as
select
  p.id as user_id,
  p.email,
  p.full_name,
  p.reward_balance,
  p.lifetime_rewards,
  p.flexibility_score,
  p.dispatch_reliability,
  count(distinct v.id) as connected_vehicle_count,
  coalesce(sum(de.verified_kwh_shifted), 0) as lifetime_kwh_shifted,
  coalesce(sum(case when de.created_at >= date_trunc('month', now()) then de.verified_kwh_shifted else 0 end), 0) as month_kwh_shifted,
  coalesce(sum(case when rl.created_at >= date_trunc('month', now()) then rl.amount else 0 end), 0) as month_rewards
from public.profiles p
left join public.vehicles v on v.user_id = p.id and v.is_active = true
left join public.dispatch_events de on de.user_id = p.id
left join public.reward_ledger rl on rl.user_id = p.id
group by p.id, p.email, p.full_name, p.reward_balance, p.lifetime_rewards, p.flexibility_score, p.dispatch_reliability;

create or replace view public.admin_network_summary as
select
  count(distinct p.id) filter (where p.role = 'participant') as participant_count,
  count(distinct v.id) as connected_vehicle_count,
  coalesce(sum(v.controllable_kw), 0) as controllable_kw,
  coalesce(sum(bp.flexible_kwh_estimate), 0) as flexible_kwh_estimate,
  coalesce(avg(bp.dispatch_confidence), 0) as avg_dispatch_confidence,
  coalesce(sum(case when rl.created_at >= date_trunc('month', now()) then rl.amount else 0 end), 0) as monthly_reward_liability,
  coalesce(sum(case when de.created_at >= date_trunc('month', now()) then de.verified_kwh_shifted else 0 end), 0) as month_kwh_shifted
from public.profiles p
left join public.vehicles v on v.user_id = p.id and v.is_active = true
left join public.behavior_profiles bp on bp.vehicle_id = v.id
left join public.reward_ledger rl on rl.user_id = p.id
left join public.dispatch_events de on de.user_id = p.id;

-- =========================================
-- OPTIONAL SEED DATA
-- Use after creating at least one auth user/profile if needed.
-- =========================================

-- Example: manually promote yourself to admin after logging in once:
-- update public.profiles set role = 'admin' where email = 'your_email@example.com';
