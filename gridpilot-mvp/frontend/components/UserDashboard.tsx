"use client";

import { useState } from "react";
import {
  BatteryCharging,
  Bell,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronRight,
  Coins,
  Gauge,
  Lock,
  LogOut,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  Zap,
} from "lucide-react";
import { logoutUser } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

const defaultEvents = [
    {
      id: 1,
      date: "May 5",
      title: "Charging delayed during peak grid window",
      detail: "18.4 kWh shifted",
      reward: "$3.25",
    },
    {
      id: 2,
      date: "May 3",
      title: "Overnight charging optimized",
      detail: "11.7 kWh shifted",
      reward: "$2.10",
    },
    {
      id: 3,
      date: "Apr 29",
      title: "Peak flexibility event assisted",
      detail: "25.2 kWh shifted",
      reward: "$4.50",
    },
  ];

function StatCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
          {caption ? <p className="mt-2 text-sm text-slate-500">{caption}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">{icon}</div>
        ) : null}
      </div>
    </div>
  );
}

type DashboardSummary = {
  email?: string | null;
  reward_balance?: number | null;
  lifetime_rewards?: number | null;
  flexibility_score?: number | null;
  dispatch_reliability?: number | null;
  lifetime_kwh_shifted?: number | null;
  month_rewards?: number | null;
};

type VehicleRow = {
  display_name?: string | null;
  state?: string | null;
  controllable_kw?: number | null;
};

type SnapshotRow = {
  battery_level?: number | null;
  charging_state?: string | null;
};

export function UserDashboard({
  dashboardSummary,
  vehicle,
  latestSnapshot,
  hasTeslaConnection,
}: {
  dashboardSummary: DashboardSummary | null;
  vehicle: VehicleRow | null;
  latestSnapshot: SnapshotRow | null;
  hasTeslaConnection: boolean;
}) {
  const [autoFlex, setAutoFlex] = useState(true);
  const [manualOverride, setManualOverride] = useState(true);
  const [rewardNotifications, setRewardNotifications] = useState(true);
  const [minimumBattery, setMinimumBattery] = useState(45);
  const [maxDelay, setMaxDelay] = useState(4);
  const [payoutMethod, setPayoutMethod] = useState("Venmo");
  const [saved, setSaved] = useState(false);

  const firstName = dashboardSummary?.email?.split("@")[0] || "Driver";
  const monthlyRewards = Number(dashboardSummary?.month_rewards ?? 0);
  const lifetimeRewards = Number(dashboardSummary?.lifetime_rewards ?? 0);
  const pendingPayout = Number(dashboardSummary?.reward_balance ?? 0);
  const flexibilityScore = Number(dashboardSummary?.flexibility_score ?? 0);
  const dispatchReliability = Number(dashboardSummary?.dispatch_reliability ?? 0);
  const shiftedKwh = Number(dashboardSummary?.lifetime_kwh_shifted ?? 0);

  const vehicleName = vehicle?.display_name || "No vehicle connected";
  const battery = latestSnapshot?.battery_level ?? 0;
  const chargingStatus = latestSnapshot?.charging_state || vehicle?.state || "Not connected";
  const controllableKw = Number(vehicle?.controllable_kw ?? 0);

  function savePreferences() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo />

        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          {hasTeslaConnection ? (
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 sm:gap-3 sm:px-4 sm:text-sm">
              <CheckCircle2 className="h-4 w-4 text-grid-600" />
              Tesla connected
            </div>
          ) : (
            <a
              href="/tesla/connect"
              className="inline-flex items-center gap-2 rounded-full bg-grid-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-grid-500 sm:text-sm"
            >
              Connect Tesla
            </a>
          )}
          <button
            onClick={logoutUser}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 sm:text-sm"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-6">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">
              User dashboard
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Your EV is earning passive rewards by making charging flexible when the grid needs it.
            </p>
          </div>

          <button
            onClick={savePreferences}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
            {saved ? "Preferences saved" : "Save preferences"}
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm md:col-span-1">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300">This month</p>
                    <p className="text-4xl font-semibold">
                      ${monthlyRewards.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-sm text-slate-300">Pending payout</p>
                    <p className="mt-1 text-2xl font-semibold">
                      ${pendingPayout.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-sm text-slate-300">Lifetime rewards</p>
                    <p className="mt-1 text-2xl font-semibold">
                      ${lifetimeRewards.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <StatCard
                label="Flexibility score"
                value={`${flexibilityScore.toFixed(0)}`}
                caption="Behavior-based estimate"
                icon={<Gauge className="h-6 w-6" />}
              />
              <StatCard
                label="Dispatch reliability"
                value={`${dispatchReliability.toFixed(0)}%`}
                caption="Predicted successful response"
                icon={<ShieldCheck className="h-6 w-6" />}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              <StatCard
                label="Energy shifted"
                value={`${shiftedKwh.toFixed(1)} kWh`}
                icon={<PlugZap className="h-6 w-6" />}
              />
              <StatCard
                label="Events assisted"
                value={hasTeslaConnection ? "Live" : "0"}
                icon={<CalendarClock className="h-6 w-6" />}
              />
              <StatCard
                label="Controllable load"
                value={`${controllableKw.toFixed(1)} kW`}
                icon={<Zap className="h-6 w-6" />}
              />
              <StatCard
                label="Est. monthly range"
                value={hasTeslaConnection ? "Live estimate pending" : "$0-$0"}
                icon={<WalletCards className="h-6 w-6" />}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                      <Car className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        {vehicleName}
                      </h2>
                      <p className="text-sm text-slate-500">Connected vehicle</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-grid-50 px-3 py-1 text-xs font-semibold text-grid-900">
                    Active
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <BatteryCharging className="h-5 w-5 text-slate-500" />
                    <p className="mt-3 text-sm text-slate-500">Battery</p>
                    <p className="text-2xl font-semibold text-slate-950">
                      {battery}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <PlugZap className="h-5 w-5 text-slate-500" />
                    <p className="mt-3 text-sm text-slate-500">Status</p>
                    <p className="text-xl font-semibold text-slate-950">
                      {chargingStatus}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <SlidersHorizontal className="h-5 w-5 text-slate-500" />
                    <p className="mt-3 text-sm text-slate-500">Flexible energy</p>
                    <p className="text-xl font-semibold text-slate-950">
                      {hasTeslaConnection ? "Live soon" : "0.0 kWh"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Recent rewards
                    </h2>
                    <p className="text-sm text-slate-500">Flexibility event history</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {defaultEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-950">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {event.date} · {event.detail}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-grid-600">{event.reward}</p>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                <Settings2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Preferences
                </h2>
                <p className="text-sm text-slate-500">Editable in one place</p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">Automatic flexibility</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Allow GridPilot to optimize charging in the background.
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoFlex(!autoFlex)}
                    className={`relative h-7 w-12 rounded-full transition ${
                      autoFlex ? "bg-grid-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        autoFlex ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <label className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">Minimum battery floor</p>
                    <p className="mt-1 text-sm text-slate-500">
                      GridPilot will avoid flexible delays below this level.
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-slate-950">
                    {minimumBattery}%
                  </span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={minimumBattery}
                  onChange={(e) => setMinimumBattery(Number(e.target.value))}
                  className="mt-4 w-full accent-emerald-600"
                />
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <label className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">Max charging delay</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Conservative cap for background optimization.
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-slate-950">
                    {maxDelay}h
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                  className="mt-4 w-full accent-emerald-600"
                />
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-950">Payout method</p>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-950 outline-none ring-grid-600 focus:ring-2"
                >
                  <option>Venmo</option>
                  <option>PayPal</option>
                  <option>ACH bank transfer</option>
                  <option>Statement credit</option>
                  <option>Gift card</option>
                </select>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setManualOverride(!manualOverride)}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-950">Manual override</p>
                      <p className="text-sm text-slate-500">User always stays in control.</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      manualOverride
                        ? "bg-grid-50 text-grid-900"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {manualOverride ? "On" : "Off"}
                  </span>
                </button>

                <button
                  onClick={() => setRewardNotifications(!rewardNotifications)}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-950">Reward alerts</p>
                      <p className="text-sm text-slate-500">Notify when rewards are earned.</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      rewardNotifications
                        ? "bg-grid-50 text-grid-900"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {rewardNotifications ? "On" : "Off"}
                  </span>
                </button>
              </div>

              <button
                onClick={savePreferences}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500"
              >
                <Save className="h-4 w-4" />
                {saved ? "Saved" : "Save all preferences"}
              </button>

              <p className="text-xs leading-5 text-slate-500">
                These are user-facing guardrails. The behavior engine should still infer
                normal charging patterns automatically in the background.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
