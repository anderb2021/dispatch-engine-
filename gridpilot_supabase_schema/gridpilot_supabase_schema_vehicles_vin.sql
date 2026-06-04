-- Store full VIN for Fleet API vehicle_data (location fetch prefers VIN path).
alter table public.vehicles
  add column if not exists vin text;

create index if not exists idx_vehicles_vin on public.vehicles(vin) where vin is not null;
