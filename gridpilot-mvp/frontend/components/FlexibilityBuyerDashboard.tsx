"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coins,
  Download,
  FileText,
  Gauge,
  LogOut,
  MapPin,
  PlugZap,
  Plus,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WalletCards,
} from "lucide-react";
import { logoutBuyerDemo } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

const buyerData = {
  buyer: {
    name: "Pilot Flex Buyer",
    accountType: "Utility / Aggregator",
    status: "Sandbox active",
  },
  capacity: {
    availableKw: 273.6,
    forecastedKwh: 931.4,
    activeParticipants: 42,
    connectedVehicles: 38,
    reliability: 91,
    avgFlexScore: 78,
    regions: ["NJ", "NY"],
  },
  settlements: {
    monthToDate: 742.18,
    pending: 318.44,
    clearedEvents: 9,
    avgPricePerKwh: 0.12,
  },
  requests: [
    {
      id: "REQ-FLEX-301",
      window: "Today 5:00 PM – 8:00 PM",
      region: "NJ",
      requestedKw: 125,
      status: "Active",
      price: "$0.16/kWh",
      delivery: "On track",
    },
    {
      id: "REQ-FLEX-300",
      window: "Tomorrow 4:00 PM – 7:00 PM",
      region: "NY",
      requestedKw: 90,
      status: "Scheduled",
      price: "$0.14/kWh",
      delivery: "Forecast ready",
    },
    {
      id: "REQ-FLEX-299",
      window: "May 5 4:30 PM – 7:30 PM",
      region: "NJ",
      requestedKw: 150,
      status: "Settled",
      price: "$0.15/kWh",
      delivery: "Delivered 142 kW",
    },
  ],
  events: [
    {
      id: "DSP-8801",
      time: "Today 5:15 PM",
      requestedKw: 125,
      deliveredKw: 118.4,
      verifiedKwh: 318.6,
      reliability: 94,
      settlement: 52.22,
      status: "In progress",
    },
    {
      id: "DSP-8800",
      time: "Yesterday 6:05 PM",
      requestedKw: 100,
      deliveredKw: 96.7,
      verifiedKwh: 244.1,
      reliability: 97,
      settlement: 38.64,
      status: "Verified",
    },
    {
      id: "DSP-8799",
      time: "May 5 4:30 PM",
      requestedKw: 150,
      deliveredKw: 142.2,
      verifiedKwh: 402.7,
      reliability: 95,
      settlement: 61.18,
      status: "Settled",
    },
  ],
};

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const classes =
    normalized.includes("active") || normalized.includes("verified") || normalized.includes("settled") || normalized.includes("on track")
      ? "bg-grid-50 text-grid-900"
      : normalized.includes("scheduled") || normalized.includes("progress") || normalized.includes("forecast")
      ? "bg-amber-50 text-amber-900"
      : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

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
    <div className={`rounded-2xl p-5 shadow-sm ring-1 ${dark ? "bg-slate-950 text-white ring-slate-900" : "bg-white text-slate-950 ring-slate-200"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-500"}`}>{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {caption ? <p className={`mt-2 text-sm ${dark ? "text-slate-300" : "text-slate-500"}`}>{caption}</p> : null}
        </div>
        {icon ? <div className={`rounded-2xl p-3 ${dark ? "bg-white/10" : "bg-grid-50 text-grid-600"}`}>{icon}</div> : null}
      </div>
    </div>
  );
}

export function FlexibilityBuyerDashboard() {
  const [region, setRegion] = useState("NJ");
  const [requestedKw, setRequestedKw] = useState(100);
  const [maxPrice, setMaxPrice] = useState(0.15);
  const [startWindow, setStartWindow] = useState("17:00");
  const [endWindow, setEndWindow] = useState("20:00");
  const [submitted, setSubmitted] = useState(false);

  function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2200);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Buyers
          </span>
        </div>

        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 sm:gap-3 sm:px-4 sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-grid-600" />
            {buyerData.buyer.status}
          </div>
          <button
            onClick={logoutBuyerDemo}
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
              Flexibility buyer dashboard
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Request and track distributed EV flexibility.
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              View available capacity, submit dispatch requests, monitor delivery, and track settlements across GridPilot’s residential EV network.
            </p>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            <Download className="h-4 w-4" />
            Export report
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          <StatCard
            dark
            label="Available flexible capacity"
            value={`${buyerData.capacity.availableKw.toFixed(1)} kW`}
            caption="Forecasted dispatchable EV load"
            icon={<PlugZap className="h-6 w-6" />}
          />
          <StatCard
            label="Forecasted flexible energy"
            value={`${buyerData.capacity.forecastedKwh.toFixed(0)} kWh`}
            caption="Current available window"
            icon={<BatteryCharging className="h-6 w-6" />}
          />
          <StatCard
            label="Portfolio reliability"
            value={`${buyerData.capacity.reliability}%`}
            caption="Predicted delivery confidence"
            icon={<ShieldCheck className="h-6 w-6" />}
          />
          <StatCard
            label="Participants"
            value={`${buyerData.capacity.activeParticipants}`}
            caption={`${buyerData.capacity.connectedVehicles} connected vehicles`}
            icon={<Users className="h-6 w-6" />}
          />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-4">
          <StatCard
            label="Month-to-date settlements"
            value={`$${buyerData.settlements.monthToDate.toFixed(2)}`}
            caption="Buyer payable"
            icon={<Coins className="h-6 w-6" />}
          />
          <StatCard
            label="Pending verification"
            value={`$${buyerData.settlements.pending.toFixed(2)}`}
            caption="Awaiting final settlement"
            icon={<WalletCards className="h-6 w-6" />}
          />
          <StatCard
            label="Cleared events"
            value={`${buyerData.settlements.clearedEvents}`}
            caption="Verified dispatches"
            icon={<CheckCircle2 className="h-6 w-6" />}
          />
          <StatCard
            label="Avg clearing price"
            value={`$${buyerData.settlements.avgPricePerKwh.toFixed(2)}`}
            caption="Per verified kWh"
            icon={<Gauge className="h-6 w-6" />}
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Create flexibility request</h2>
                  <p className="text-sm text-slate-500">Submit a dispatch window</p>
                </div>
              </div>

              <form onSubmit={submitRequest} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Region</span>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none ring-grid-600 focus:ring-2"
                  >
                    <option>NJ</option>
                    <option>NY</option>
                    <option>NJ + NY</option>
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Start</span>
                    <input
                      type="time"
                      value={startWindow}
                      onChange={(e) => setStartWindow(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none ring-grid-600 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">End</span>
                    <input
                      type="time"
                      value={endWindow}
                      onChange={(e) => setEndWindow(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none ring-grid-600 focus:ring-2"
                    />
                  </label>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">Requested capacity</p>
                      <p className="mt-1 text-sm text-slate-500">Target flexible load reduction.</p>
                    </div>
                    <span className="text-lg font-semibold text-slate-950">{requestedKw} kW</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="275"
                    value={requestedKw}
                    onChange={(e) => setRequestedKw(Number(e.target.value))}
                    className="mt-4 w-full accent-emerald-600"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">Max price</p>
                      <p className="mt-1 text-sm text-slate-500">Maximum payable per verified kWh.</p>
                    </div>
                    <span className="text-lg font-semibold text-slate-950">${maxPrice.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.03"
                    max="0.5"
                    step="0.01"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="mt-4 w-full accent-emerald-600"
                  />
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500"
                >
                  {submitted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Request submitted
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit request
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-grid-500" />
                <div>
                  <h3 className="font-semibold">Buyer portal note</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This dashboard should expose aggregate portfolio data only. Do not show individual household identities to flexibility buyers.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Active flexibility requests</h2>
                  <p className="text-sm text-slate-500">Buyer-submitted windows and delivery status</p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Request</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {buyerData.requests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-950">{request.id}</p>
                          <p className="text-xs text-slate-500">{request.window}</p>
                          <p className="mt-1 text-xs text-grid-600">{request.delivery}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            {request.region}
                          </div>
                        </td>
                        <td className="px-4 py-4">{request.requestedKw} kW</td>
                        <td className="px-4 py-4">{request.price}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={request.status} />
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
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Dispatch tracking</h2>
                  <p className="text-sm text-slate-500">Verified performance and settlement history</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {buyerData.events.map((event) => (
                  <div key={event.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{event.id}</p>
                          <StatusBadge status={event.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{event.time}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5 md:text-right">
                        <div>
                          <p className="text-slate-500">Requested</p>
                          <p className="font-semibold text-slate-950">{event.requestedKw} kW</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Delivered</p>
                          <p className="font-semibold text-slate-950">{event.deliveredKw} kW</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Verified</p>
                          <p className="font-semibold text-slate-950">{event.verifiedKwh} kWh</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Reliability</p>
                          <p className="font-semibold text-slate-950">{event.reliability}%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Settlement</p>
                          <p className="font-semibold text-grid-600">${event.settlement.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <FileText className="h-6 w-6 text-grid-600" />
                <h3 className="mt-4 text-xl font-semibold text-slate-950">Reports</h3>
                <p className="mt-2 text-slate-600">
                  Download verified dispatch, M&V, and settlement summaries for procurement records.
                </p>
                <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                  View reports
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <Activity className="h-6 w-6 text-grid-600" />
                <h3 className="mt-4 text-xl font-semibold text-slate-950">Forecasting</h3>
                <p className="mt-2 text-slate-600">
                  View next-day flexible capacity forecasts by region, time window, and confidence score.
                </p>
                <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 ring-1 ring-slate-200">
                  Open forecast
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
