"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Car,
  CheckCircle2,
  Coins,
  Gauge,
  MapPin,
  PlugZap,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WalletCards,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  fallbackDailyFlex,
  fallbackRecentSnapshots,
  fallbackTelemetrySummary,
  type DailyFlexRow,
  type RecentSnapshotRow,
  type TelemetrySummary,
} from "@/lib/telemetryAnalytics";
import {
  fallbackAdminMarketplaceSummary,
  type AdminMarketplaceSummary,
  type AdminMarketplaceUserRow,
} from "@/lib/marketplaceQualification";

type AdminUser = {
  id: string;
  name: string;
  vehicle: string;
  battery: number;
  status: string;
  flexScore: number;
  reliability: number;
  rewards: number;
  controllableKw: number;
  userId?: string;
  teslaConnected?: boolean;
};

type TeslaSyncResult = {
  userId: string;
  vehiclesOk: boolean;
  telemetryOk: boolean;
  error?: string;
};

type TeslaSyncResponse = {
  syncedUsers: number;
  successCount: number;
  failedCount: number;
  results?: TeslaSyncResult[];
  error?: string;
};

type LocationPullVehicle = {
  display_name?: string;
  plugged_in?: boolean | null;
  tesla_latitude?: number | null;
  tesla_longitude?: number | null;
  location_stored?: boolean;
  note?: string | null;
  error?: string | null;
};

type LocationPullResponse = {
  users_polled?: number;
  has_location_scope?: boolean;
  vehicles?: LocationPullVehicle[];
  errors?: string[];
};

const fallbackAdminData = {
  network: {
    activeUsers: 42,
    connectedVehicles: 38,
    controllableKw: 273.6,
    flexibleKwh: 931.4,
    dispatchReliability: 91,
    monthlyRewardLiability: 742.18,
    shiftedKwhMonth: 2680,
    avgFlexScore: 78,
  },
  users: [
    {
      id: "U-1001",
      name: "Brian Anderson",
      vehicle: "Tesla Model Y",
      battery: 68,
      status: "Plugged in",
      flexScore: 82,
      reliability: 91,
      rewards: 18.42,
      controllableKw: 7.2,
    },
    {
      id: "U-1002",
      name: "Pilot User 2",
      vehicle: "Tesla Model 3",
      battery: 74,
      status: "Idle",
      flexScore: 76,
      reliability: 88,
      rewards: 14.08,
      controllableKw: 7.6,
    },
    {
      id: "U-1003",
      name: "Pilot User 3",
      vehicle: "Tesla Model Y",
      battery: 51,
      status: "Charging",
      flexScore: 69,
      reliability: 81,
      rewards: 9.75,
      controllableKw: 6.8,
    },
    {
      id: "U-1004",
      name: "Pilot User 4",
      vehicle: "Tesla Model X",
      battery: 82,
      status: "Plugged in",
      flexScore: 91,
      reliability: 96,
      rewards: 24.33,
      controllableKw: 11.2,
    },
  ],
  events: [
    {
      id: "D-5001",
      time: "Today 5:15 PM",
      type: "Peak delay",
      users: 21,
      kw: 142.4,
      kwh: 318.6,
      rewards: 52.22,
      status: "Completed",
    },
    {
      id: "D-5000",
      time: "Yesterday 6:05 PM",
      type: "Simulated dispatch",
      users: 18,
      kw: 119.7,
      kwh: 244.1,
      rewards: 38.64,
      status: "Completed",
    },
    {
      id: "D-4999",
      time: "May 5 4:30 PM",
      type: "Peak delay",
      users: 26,
      kw: 171.2,
      kwh: 402.7,
      rewards: 61.18,
      status: "Completed",
    },
  ],
};

type AdminTelemetry = typeof fallbackAdminData & {
  network: (typeof fallbackAdminData)["network"] & {
    signupsTotal?: number;
    signupsLast7Days?: number;
  };
  users: AdminUser[];
  generatedAt?: string;
};


function StatCard({
  label,
  value,
  caption,
  icon,
  dark = false,
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-sm ring-1 ${
        dark
          ? "bg-slate-950 text-white ring-slate-900"
          : "bg-white text-slate-950 ring-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-500"}`}>
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {caption ? (
            <p className={`mt-2 text-sm ${dark ? "text-slate-300" : "text-slate-500"}`}>
              {caption}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className={`rounded-2xl p-3 ${dark ? "bg-white/10" : "bg-grid-50 text-grid-600"}`}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [dispatchMode, setDispatchMode] = useState("Simulation only");
  const [minReliability, setMinReliability] = useState(80);
  const [maxRewardRate, setMaxRewardRate] = useState(0.12);
  const [search, setSearch] = useState("");
  const [telemetry, setTelemetry] = useState<AdminTelemetry | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(true);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [isSyncingAllTesla, setIsSyncingAllTesla] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<TeslaSyncResult[]>([]);
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary | null>(null);
  const [recentSnapshots, setRecentSnapshots] = useState<RecentSnapshotRow[]>([]);
  const [dailyFlex, setDailyFlex] = useState<DailyFlexRow[]>([]);
  const [isLoadingFlexAnalytics, setIsLoadingFlexAnalytics] = useState(true);
  const [flexAnalyticsError, setFlexAnalyticsError] = useState<string | null>(null);
  const [usingFlexFallback, setUsingFlexFallback] = useState(false);
  const [isPullingLocationAll, setIsPullingLocationAll] = useState(false);
  const [pullingLocationUserId, setPullingLocationUserId] = useState<string | null>(null);
  const [locationStatusMessage, setLocationStatusMessage] = useState<string | null>(null);
  const [marketplaceSummary, setMarketplaceSummary] =
    useState<AdminMarketplaceSummary | null>(null);
  const [marketplaceUsers, setMarketplaceUsers] = useState<AdminMarketplaceUserRow[]>([]);
  const [isLoadingMarketplace, setIsLoadingMarketplace] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);

  const loadMarketplaceQualification = useCallback(async () => {
    setIsLoadingMarketplace(true);
    setMarketplaceError(null);
    let usedFallback = false;
    const [summaryRes, usersRes] = await Promise.all([
      fetch("/api/admin/marketplace-qualification/summary", { cache: "no-store" }),
      fetch("/api/admin/marketplace-qualification/users", { cache: "no-store" }),
    ]);
    if (summaryRes.ok) {
      setMarketplaceSummary((await summaryRes.json()) as AdminMarketplaceSummary);
    } else {
      usedFallback = true;
      setMarketplaceSummary(fallbackAdminMarketplaceSummary);
    }
    if (usersRes.ok) {
      const payload = (await usersRes.json()) as { users?: AdminMarketplaceUserRow[] };
      setMarketplaceUsers(payload.users ?? []);
    } else {
      usedFallback = true;
    }
    if (usedFallback) {
      setMarketplaceError("Marketplace qualification API unavailable. Showing sample data.");
    }
    setIsLoadingMarketplace(false);
  }, []);

  const loadTelemetry = useCallback(async () => {
    setIsLoadingTelemetry(true);
    setTelemetryError(null);
    try {
      const response = await fetch("/api/admin/telemetry", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Telemetry request failed (${response.status})`);
      }
      const payload = (await response.json()) as AdminTelemetry;
      setTelemetry(payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load telemetry. Showing fallback data.";
      setTelemetryError(message);
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  const loadFlexAnalytics = useCallback(async () => {
    setIsLoadingFlexAnalytics(true);
    setFlexAnalyticsError(null);
    let usedFallback = false;

    const [summaryRes, recentRes, dailyRes] = await Promise.all([
      fetch("/api/admin/telemetry/summary", { cache: "no-store" }),
      fetch("/api/admin/telemetry/recent", { cache: "no-store" }),
      fetch("/api/admin/flexibility/daily", { cache: "no-store" }),
    ]);

    if (summaryRes.ok) {
      setTelemetrySummary((await summaryRes.json()) as TelemetrySummary);
    } else {
      usedFallback = true;
      setTelemetrySummary(fallbackTelemetrySummary);
    }

    if (recentRes.ok) {
      const payload = (await recentRes.json()) as { snapshots?: RecentSnapshotRow[] };
      setRecentSnapshots(payload.snapshots ?? fallbackRecentSnapshots);
    } else {
      usedFallback = true;
      setRecentSnapshots(fallbackRecentSnapshots);
    }

    if (dailyRes.ok) {
      const payload = (await dailyRes.json()) as { days?: DailyFlexRow[] };
      setDailyFlex(payload.days ?? fallbackDailyFlex);
    } else {
      usedFallback = true;
      setDailyFlex(fallbackDailyFlex);
    }

    if (usedFallback) {
      setFlexAnalyticsError("Telemetry analytics API unavailable. Showing sample data.");
    }
    setUsingFlexFallback(usedFallback);
    setIsLoadingFlexAnalytics(false);
  }, []);

  useEffect(() => {
    loadTelemetry();
    loadFlexAnalytics();
    loadMarketplaceQualification();
  }, [loadTelemetry, loadFlexAnalytics, loadMarketplaceQualification]);

  const data: AdminTelemetry = telemetry ?? fallbackAdminData;
  const flexSummary = telemetrySummary ?? fallbackTelemetrySummary;
  const flexRecent = recentSnapshots.length ? recentSnapshots : fallbackRecentSnapshots;
  const flexDaily = dailyFlex.length ? dailyFlex : fallbackDailyFlex;
  const mktSummary = marketplaceSummary ?? fallbackAdminMarketplaceSummary;

  const filteredUsers: AdminUser[] = data.users.filter((user) =>
    `${user.name} ${user.vehicle} ${user.id}`.toLowerCase().includes(search.toLowerCase())
  );

  async function syncTeslaForAllUsers() {
    if (isSyncingAllTesla) return;
    setSyncStatusMessage(null);
    setSyncErrors([]);
    setIsSyncingAllTesla(true);
    try {
      const response = await fetch("/api/admin/tesla-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all", includeVehicles: true, includeTelemetry: true }),
      });
      const payload = (await response.json()) as TeslaSyncResponse;
      if (!response.ok) {
        throw new Error(payload?.error || `Tesla sync failed (${response.status})`);
      }
      setSyncStatusMessage(
        `Tesla sync finished: ${payload.successCount}/${payload.syncedUsers} users updated.`
      );
      const failedResults = (payload.results ?? []).filter((item) => Boolean(item.error));
      setSyncErrors(failedResults);
      await loadTelemetry();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync Tesla data.";
      setSyncStatusMessage(message);
    } finally {
      setIsSyncingAllTesla(false);
    }
  }

  async function pullLocationForAllUsers() {
    if (isPullingLocationAll) return;
    setLocationStatusMessage(null);
    setIsPullingLocationAll(true);
    try {
      const response = await fetch("/api/admin/tesla-pull-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all", wake: true }),
      });
      const payload = (await response.json()) as LocationPullResponse;
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || `Pull failed (${response.status})`);
      }
      const stored = (payload.vehicles ?? []).filter((v) => v.location_stored).length;
      const total = payload.vehicles?.length ?? 0;
      setLocationStatusMessage(
        `Location pull finished: stored for ${stored}/${total} vehicles.` +
          (payload.has_location_scope === false
            ? " Some users may need to re-connect Tesla (vehicle_location scope)."
            : "")
      );
      await loadFlexAnalytics();
    } catch (error) {
      setLocationStatusMessage(
        error instanceof Error ? error.message : "Unable to pull Tesla location."
      );
    } finally {
      setIsPullingLocationAll(false);
    }
  }

  async function pullLocationForUser(userId?: string) {
    if (!userId || pullingLocationUserId) return;
    setLocationStatusMessage(null);
    setPullingLocationUserId(userId);
    try {
      const response = await fetch("/api/admin/tesla-pull-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "user", userId, wake: true }),
      });
      const payload = (await response.json()) as LocationPullResponse;
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || `Pull failed (${response.status})`);
      }
      const vehicle = payload.vehicles?.[0];
      if (vehicle?.location_stored) {
        setLocationStatusMessage(
          `Location stored for ${vehicle.display_name ?? "vehicle"} (plugged in: ${
            vehicle.plugged_in ? "yes" : "no"
          }).`
        );
      } else if (vehicle?.tesla_latitude != null) {
        setLocationStatusMessage(vehicle.note ?? "Tesla returned location but it was not stored.");
      } else {
        setLocationStatusMessage(
          vehicle?.note ??
            vehicle?.error ??
            "No location returned. Re-connect Tesla with location permission while plugged in."
        );
      }
      await loadFlexAnalytics();
    } catch (error) {
      setLocationStatusMessage(
        error instanceof Error ? error.message : "Unable to pull Tesla location."
      );
    } finally {
      setPullingLocationUserId(null);
    }
  }

  async function syncTeslaForUser(userId?: string) {
    if (!userId || syncingUserId) return;
    setSyncStatusMessage(null);
    setSyncErrors([]);
    setSyncingUserId(userId);
    try {
      const response = await fetch("/api/admin/tesla-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "user",
          userId,
          includeVehicles: true,
          includeTelemetry: true,
        }),
      });
      const payload = (await response.json()) as TeslaSyncResponse;
      if (!response.ok) {
        throw new Error(payload?.error || `Tesla sync failed (${response.status})`);
      }
      const result = Array.isArray(payload.results) ? payload.results[0] : undefined;
      if (result?.error) {
        setSyncStatusMessage(`User sync failed: ${result.error}`);
        setSyncErrors([result]);
      } else {
        setSyncStatusMessage("User Tesla data refreshed.");
      }
      await loadTelemetry();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync Tesla data.";
      setSyncStatusMessage(message);
    } finally {
      setSyncingUserId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Admin
          </span>
        </div>

        <div className="hidden items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 sm:flex">
          <ShieldCheck className="h-4 w-4 text-grid-600" />
          Admin mode
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-6">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">
              Network overview
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Flexibility operations dashboard.
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Monitor users, connected vehicles, rewards, and dispatch performance across the GridPilot pilot network.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={syncTeslaForAllUsers}
              disabled={isSyncingAllTesla}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <PlugZap className="h-4 w-4" />
              {isSyncingAllTesla ? "Syncing Tesla..." : "Sync all Tesla data"}
            </button>
            <button
              onClick={() => {
                loadTelemetry();
                loadFlexAnalytics();
                loadMarketplaceQualification();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              {isLoadingTelemetry || isLoadingFlexAnalytics ? "Refreshing..." : "Refresh network"}
            </button>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          {telemetryError
            ? `Telemetry unavailable (${telemetryError}). Showing fallback values.`
            : data.generatedAt
            ? `Live telemetry updated ${new Date(data.generatedAt).toLocaleString()}.`
            : "Live telemetry connected."}
        </p>
        {syncStatusMessage ? <p className="mb-4 text-sm text-grid-700">{syncStatusMessage}</p> : null}
        {syncErrors.length ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-semibold text-rose-800">Tesla sync errors</p>
            <div className="mt-2 space-y-1">
              {syncErrors.slice(0, 6).map((item) => (
                <p key={`${item.userId}-${item.error}`} className="text-xs text-rose-700">
                  <span className="font-semibold">{item.userId}:</span> {item.error}
                </p>
              ))}
              {syncErrors.length > 6 ? (
                <p className="text-xs text-rose-700">
                  ...and {syncErrors.length - 6} more. Check network response for full list.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-4">
          <StatCard
            dark
            label="Controllable load"
            value={`${data.network.controllableKw.toFixed(1)} kW`}
            caption="EV charging under management"
            icon={<PlugZap className="h-6 w-6" />}
          />
          <StatCard
            label="Active users"
            value={`${data.network.activeUsers}`}
            caption={`${data.network.connectedVehicles} connected vehicles`}
            icon={<Users className="h-6 w-6" />}
          />
          <StatCard
            label="Flexible energy"
            value={`${data.network.flexibleKwh.toFixed(0)} kWh`}
            caption="Estimated available pool"
            icon={<BatteryCharging className="h-6 w-6" />}
          />
          <StatCard
            label="Dispatch reliability"
            value={`${data.network.dispatchReliability}%`}
            caption="Predicted network response"
            icon={<ShieldCheck className="h-6 w-6" />}
          />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-4">
          <StatCard
            label="Monthly rewards"
            value={`$${data.network.monthlyRewardLiability.toFixed(2)}`}
            caption="Current payout liability"
            icon={<Coins className="h-6 w-6" />}
          />
          <StatCard
            label="kWh shifted"
            value={`${data.network.shiftedKwhMonth.toLocaleString()}`}
            caption="This month"
            icon={<Activity className="h-6 w-6" />}
          />
          <StatCard
            label="Sign-ups"
            value={`${data.network.signupsTotal ?? data.network.activeUsers}`}
            caption={`+${data.network.signupsLast7Days ?? 0} in last 7 days`}
            icon={<Gauge className="h-6 w-6" />}
          />
          <StatCard
            label="Avg flex score"
            value={`${data.network.avgFlexScore}`}
            caption="Behavior engine estimate"
            icon={<WalletCards className="h-6 w-6" />}
          />
        </div>

        {/* Telemetry & Flexibility Analytics — additive section; does not move existing layout. */}
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Telemetry &amp; Flexibility Analytics
              </h2>
              <p className="text-sm text-slate-500">
                Tesla fleet charging telemetry (15-min polls) and rule-based flexibility estimates.
              </p>
            </div>
            {isLoadingFlexAnalytics ? (
              <span className="text-sm text-slate-500">Loading analytics...</span>
            ) : flexSummary.generatedAt ? (
              <span className="text-sm text-slate-500">
                Updated {new Date(flexSummary.generatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          {flexAnalyticsError ? (
            <p className="mt-3 text-sm text-amber-700">
              {flexAnalyticsError}
              {usingFlexFallback ? " Precise coordinates are never shown here." : ""}
            </p>
          ) : null}
          {locationStatusMessage ? (
            <p className="mt-3 text-sm text-grid-800">{locationStatusMessage}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={pullLocationForAllUsers}
              disabled={isPullingLocationAll}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MapPin className="h-4 w-4" />
              {isPullingLocationAll ? "Pulling location..." : "Pull location (wake + sync)"}
            </button>
            <p className="text-xs text-slate-500 self-center max-w-xl">
              Wakes each vehicle, requests Tesla location_data, and saves coordinates to Supabase
              when plugged in. Users must re-connect Tesla if vehicle_location scope is missing.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Connected vehicles"
              value={`${flexSummary.connected_vehicle_count}`}
              caption="Active Tesla-linked"
              icon={<Car className="h-6 w-6" />}
            />
            <StatCard
              label="Active last 24h"
              value={`${flexSummary.active_vehicle_count_24h}`}
              caption={`${flexSummary.snapshots_last_24h} snapshots`}
              icon={<Activity className="h-6 w-6" />}
            />
            <StatCard
              label="Plugged in now"
              value={`${flexSummary.plugged_in_now}`}
              caption={`${flexSummary.charging_now} charging`}
              icon={<PlugZap className="h-6 w-6" />}
            />
            <StatCard
              label="Telemetry lag"
              value={
                flexSummary.telemetry_lag_minutes != null
                  ? `${flexSummary.telemetry_lag_minutes} min`
                  : "—"
              }
              caption="Since last fleet snapshot"
              icon={<Gauge className="h-6 w-6" />}
            />
            <StatCard
              label="Dispatchable kW"
              value={`${flexSummary.estimated_dispatchable_kw.toFixed(1)}`}
              caption="Plugged-in estimate"
              icon={<PlugZap className="h-6 w-6" />}
            />
            <StatCard
              label="Flexible kWh today"
              value={`${flexSummary.estimated_flexible_kwh_today.toFixed(1)}`}
              caption="Idle-plugged MVP"
              icon={<BatteryCharging className="h-6 w-6" />}
            />
            <StatCard
              label="Avg flexibility score"
              value={`${flexSummary.avg_flexibility_score}`}
              caption="0–100 rule-based"
              icon={<WalletCards className="h-6 w-6" />}
            />
            <StatCard
              dark
              label="Charging now"
              value={`${flexSummary.charging_now}`}
              caption="Live charger power &gt; 0"
              icon={<BatteryCharging className="h-6 w-6" />}
            />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Recent telemetry
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Location column shows capture status only (utility/PJM eligibility uses stored
                coordinates server-side).
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2">Battery</th>
                      <th className="px-3 py-2">State</th>
                      <th className="px-3 py-2">kW</th>
                      <th className="px-3 py-2">Plugged</th>
                      <th className="px-3 py-2">Last seen</th>
                      <th className="px-3 py-2">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {flexRecent.slice(0, 12).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-900">{row.vehicle}</td>
                        <td className="px-3 py-3">{row.battery}%</td>
                        <td className="px-3 py-3 text-slate-600">{row.chargingState}</td>
                        <td className="px-3 py-3">{row.powerKw.toFixed(1)}</td>
                        <td className="px-3 py-3">{row.pluggedIn ? "Yes" : "No"}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {formatEventTime(row.lastSeen)}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-slate-700">
                          {row.locationCaptured ? "Captured" : "Not captured"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                7-day flexibility
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Daily aggregates from charging snapshots (no driving history).
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2">Flex kWh</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {flexDaily.slice(0, 7).map((row) => (
                      <tr key={row.date} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-900">{row.date}</td>
                        <td className="px-3 py-3">{row.activeVehicles}</td>
                        <td className="px-3 py-3">{row.flexibleKwh.toFixed(1)}</td>
                        <td className="px-3 py-3">{row.avgFlexScore}</td>
                        <td className="px-3 py-3">
                          {(row.dispatchConfidence * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-950">Marketplace Qualification</h2>
          <p className="mt-1 text-sm text-slate-500">
            PJM marketplace readiness — location scope, ZIP/utility verification, and eligibility
            (no precise coordinates shown).
          </p>
          {marketplaceError ? (
            <p className="mt-2 text-sm text-amber-700">{marketplaceError}</p>
          ) : null}
          {isLoadingMarketplace ? (
            <p className="mt-4 text-sm text-slate-500">Loading qualification data...</p>
          ) : (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Connected users"
                  value={`${mktSummary.total_connected_users}`}
                  icon={<Users className="h-6 w-6" />}
                />
                <StatCard
                  label="Location scope enabled"
                  value={`${mktSummary.vehicle_location_scope_enabled}`}
                  caption={`${mktSummary.missing_location_scope} missing`}
                  icon={<MapPin className="h-6 w-6" />}
                />
                <StatCard
                  label="ZIP verified"
                  value={`${mktSummary.zip_verified}`}
                  icon={<ShieldCheck className="h-6 w-6" />}
                />
                <StatCard
                  label="Utility verified"
                  value={`${mktSummary.utility_verified}`}
                  icon={<PlugZap className="h-6 w-6" />}
                />
                <StatCard
                  label="Marketplace eligible"
                  value={`${mktSummary.marketplace_eligible}`}
                  icon={<CheckCircle2 className="h-6 w-6" />}
                />
                <StatCard
                  label="Needs verification"
                  value={`${mktSummary.needs_verification}`}
                  icon={<AlertTriangle className="h-6 w-6" />}
                />
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2">ZIP</th>
                      <th className="px-3 py-2">Utility</th>
                      <th className="px-3 py-2">PJM Zone</th>
                      <th className="px-3 py-2">Location Scope</th>
                      <th className="px-3 py-2">Location Status</th>
                      <th className="px-3 py-2">Qualification Status</th>
                      <th className="px-3 py-2">Next Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {marketplaceUsers.slice(0, 50).map((row) => (
                      <tr key={row.user_id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-3 py-3 text-slate-600">{row.vehicle}</td>
                        <td className="px-3 py-3">{row.zip_code}</td>
                        <td className="px-3 py-3">{row.utility_provider}</td>
                        <td className="px-3 py-3">{row.pjm_zone}</td>
                        <td className="px-3 py-3">{row.location_scope}</td>
                        <td className="px-3 py-3 text-xs">{row.location_verification}</td>
                        <td className="px-3 py-3">{row.qualification_status}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{row.next_action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                <SlidersHorizontal className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Pilot controls</h2>
                <p className="text-sm text-slate-500">Operational guardrails</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Keep dispatch conservative</p>
                    <p className="mt-1 text-sm">
                      Use simulation mode until user consent, Tesla command permissions, and reward terms are finalized.
                    </p>
                  </div>
                </div>
              </div>

              <label className="block rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-medium text-slate-700">Dispatch mode</span>
                <select
                  value={dispatchMode}
                  onChange={(e) => setDispatchMode(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-950 outline-none ring-grid-600 focus:ring-2"
                >
                  <option>Simulation only</option>
                  <option>Soft recommendations</option>
                  <option>Live dispatch - pilot users only</option>
                  <option>Live dispatch - all eligible users</option>
                </select>
              </label>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">Minimum reliability</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Only include users above this predicted response score.
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-slate-950">{minReliability}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={minReliability}
                  onChange={(e) => setMinReliability(Number(e.target.value))}
                  className="mt-4 w-full accent-emerald-600"
                />
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">Max reward rate</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Maximum reward paid per shifted kWh.
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-slate-950">
                    ${maxRewardRate.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.5"
                  step="0.01"
                  value={maxRewardRate}
                  onChange={(e) => setMaxRewardRate(Number(e.target.value))}
                  className="mt-4 w-full accent-emerald-600"
                />
              </div>

              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500">
                <Save className="h-4 w-4" />
                Save pilot controls
              </button>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Users & vehicles</h2>
                  <p className="text-sm text-slate-500">Connected pilot participants</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 md:w-64"
                  />
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Battery</th>
                      <th className="px-4 py-3">Flex</th>
                      <th className="px-4 py-3">Reliability</th>
                      <th className="px-4 py-3">Rewards</th>
                      <th className="px-4 py-3">Tesla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-950">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.id}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-medium text-slate-800">{user.vehicle}</p>
                              <p className="text-xs text-slate-500">{user.status}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">{user.battery}%</td>
                        <td className="px-4 py-4">{user.flexScore}</td>
                        <td className="px-4 py-4">{user.reliability}%</td>
                        <td className="px-4 py-4 font-semibold text-grid-600">
                          ${user.rewards.toFixed(2)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => syncTeslaForUser(user.userId)}
                              disabled={!user.userId || syncingUserId === user.userId}
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {syncingUserId === user.userId ? "Syncing..." : "Sync"}
                            </button>
                            <button
                              type="button"
                              onClick={() => pullLocationForUser(user.userId)}
                              disabled={!user.userId || pullingLocationUserId === user.userId}
                              className="rounded-full bg-grid-50 px-3 py-1.5 text-xs font-semibold text-grid-800 transition hover:bg-grid-100 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Wake vehicle and pull location from Tesla"
                            >
                              {pullingLocationUserId === user.userId ? "..." : "Location"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                  <PlugZap className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Dispatch events</h2>
                  <p className="text-sm text-slate-500">Recent network actions</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {data.events.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-950">{event.type}</p>
                        <span className="rounded-full bg-grid-50 px-2.5 py-1 text-xs font-semibold text-grid-900">
                          {event.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatEventTime(event.time)} · {event.users} users · {event.kw} kW · {event.kwh} kWh
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-sm text-slate-500">Rewards</p>
                      <p className="font-semibold text-grid-600">${event.rewards.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
