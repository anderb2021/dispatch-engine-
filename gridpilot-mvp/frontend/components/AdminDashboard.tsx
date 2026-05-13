"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Car,
  Coins,
  Gauge,
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
import { createClient } from "@/utils/supabase/client";

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
  generatedAt?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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

  const loadTelemetry = useCallback(async () => {
    setIsLoadingTelemetry(true);
    setTelemetryError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Admin session missing. Please log in again.");
      }

      const response = await fetch(`${API_BASE}/admin/telemetry`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  const data = telemetry ?? fallbackAdminData;

  const filteredUsers = data.users.filter((user) =>
    `${user.name} ${user.vehicle} ${user.id}`.toLowerCase().includes(search.toLowerCase())
  );

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

          <button
            onClick={loadTelemetry}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            {isLoadingTelemetry ? "Refreshing..." : "Refresh network"}
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          {telemetryError
            ? `Telemetry unavailable (${telemetryError}). Showing fallback values.`
            : data.generatedAt
            ? `Live telemetry updated ${new Date(data.generatedAt).toLocaleString()}.`
            : "Live telemetry connected."}
        </p>

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
