import { BatteryCharging, Car, Coins, PlugZap, Zap } from "lucide-react";

function StatCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {caption ? <p className="mt-2 text-sm text-slate-500">{caption}</p> : null}
    </div>
  );
}

export function Dashboard() {
  return (
    <section id="dashboard" className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">Pilot dashboard</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Passive rewards. Measured flexibility.</h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3"><Coins className="h-6 w-6" /></div>
            <div>
              <p className="text-sm text-slate-300">This month</p>
              <p className="text-4xl font-semibold">$18.42</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            <p className="text-sm text-slate-300">Lifetime rewards</p>
            <p className="mt-1 text-2xl font-semibold">$76.88</p>
          </div>
        </div>
        <StatCard label="Flexibility score" value="82" caption="Behavior-based estimate" />
        <StatCard label="Dispatch reliability" value="91%" caption="Predicted successful response" />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-4">
        <StatCard label="Flexible energy shifted" value="112 kWh" />
        <StatCard label="Peak events assisted" value="6" />
        <StatCard label="Controllable load" value="7.2 kW" />
        <StatCard label="Available flexibility" value="24.5 kWh" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-grid-50 p-3 text-grid-600"><Car className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Tesla Model Y</h3>
              <p className="text-sm text-slate-500">Connected vehicle</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <BatteryCharging className="h-5 w-5 text-slate-500" />
              <p className="mt-3 text-sm text-slate-500">Battery</p>
              <p className="text-2xl font-semibold text-slate-950">68%</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <PlugZap className="h-5 w-5 text-slate-500" />
              <p className="mt-3 text-sm text-slate-500">Status</p>
              <p className="text-2xl font-semibold text-slate-950">Plugged in</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <Zap className="h-6 w-6 text-grid-600" />
          <h3 className="mt-4 text-xl font-semibold text-slate-950">Background mode active</h3>
          <p className="mt-2 text-slate-600">GridPilot is learning charging behavior and estimating flexibility windows.</p>
        </div>
      </div>
    </section>
  );
}