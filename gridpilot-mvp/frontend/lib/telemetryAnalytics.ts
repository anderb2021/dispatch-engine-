/** Types + mock fallbacks for admin Telemetry & Flexibility Analytics. */

export type TelemetrySummary = {
  connected_vehicle_count: number;
  active_vehicle_count_24h: number;
  plugged_in_now: number;
  charging_now: number;
  estimated_dispatchable_kw: number;
  estimated_flexible_kwh_today: number;
  avg_flexibility_score: number;
  telemetry_lag_minutes: number | null;
  snapshots_last_24h: number;
  generatedAt?: string;
};

export type RecentSnapshotRow = {
  id: string;
  vehicle: string;
  battery: number;
  chargingState: string;
  powerKw: number;
  pluggedIn: boolean;
  lastSeen: string;
  /** Aggregate status only — never expose raw lat/lon in admin UI tables. */
  locationCaptured: boolean;
};

export type DailyFlexRow = {
  date: string;
  activeVehicles: number;
  flexibleKwh: number;
  avgFlexScore: number;
  dispatchConfidence: number;
};

export const fallbackTelemetrySummary: TelemetrySummary = {
  connected_vehicle_count: 4,
  active_vehicle_count_24h: 3,
  plugged_in_now: 2,
  charging_now: 1,
  estimated_dispatchable_kw: 14.4,
  estimated_flexible_kwh_today: 18.6,
  avg_flexibility_score: 72,
  telemetry_lag_minutes: 22,
  snapshots_last_24h: 96,
};

export const fallbackRecentSnapshots: RecentSnapshotRow[] = [
  {
    id: "demo-1",
    vehicle: "Tesla Model Y",
    battery: 68,
    chargingState: "Charging",
    powerKw: 7.2,
    pluggedIn: true,
    lastSeen: new Date().toISOString(),
    locationCaptured: true,
  },
  {
    id: "demo-2",
    vehicle: "Tesla Model 3",
    battery: 74,
    chargingState: "Complete",
    powerKw: 0,
    pluggedIn: true,
    lastSeen: new Date(Date.now() - 45 * 60_000).toISOString(),
    locationCaptured: true,
  },
  {
    id: "demo-3",
    vehicle: "Tesla Model Y",
    battery: 51,
    chargingState: "Disconnected",
    powerKw: 0,
    pluggedIn: false,
    lastSeen: new Date(Date.now() - 3 * 3600_000).toISOString(),
    locationCaptured: false,
  },
];

export const fallbackDailyFlex: DailyFlexRow[] = [
  {
    date: new Date().toISOString().slice(0, 10),
    activeVehicles: 3,
    flexibleKwh: 18.6,
    avgFlexScore: 72,
    dispatchConfidence: 0.68,
  },
  {
    date: new Date(Date.now() - 86400_000).toISOString().slice(0, 10),
    activeVehicles: 2,
    flexibleKwh: 12.4,
    avgFlexScore: 65,
    dispatchConfidence: 0.55,
  },
  {
    date: new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10),
    activeVehicles: 3,
    flexibleKwh: 21.1,
    avgFlexScore: 78,
    dispatchConfidence: 0.71,
  },
];
