import { CheckCircle2, Lock, PlugZap, Sparkles, WalletCards } from "lucide-react";
import { Dashboard } from "@/components/Dashboard";
import { ConnectTeslaButton } from "@/components/ConnectTeslaButton";
import { BrandLogo } from "@/components/BrandLogo";
import { HomeHeaderActions } from "@/components/HomeHeaderActions";
import { HomeSignInCard } from "@/components/HomeSignInCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <BrandLogo imageClassName="h-10 w-auto sm:h-[3.9rem]" />
        <HomeHeaderActions />
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-14 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-grid-900 shadow-sm ring-1 ring-grid-100">
            <Sparkles className="h-4 w-4 text-grid-600" />
            Passive EV flexibility rewards
          </div>

          <h1 className="mt-8 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl">
            Get paid when your EV charging helps the grid.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Connect your Tesla once. GridPilot learns your charging behavior in the background and rewards flexibility automatically — no daily schedules, no energy trading, no extra work.
          </p>

          <div id="join" className="mt-8 flex justify-center">
            <ConnectTeslaButton />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Connect once", "Plug in normally", "Earn automatic rewards"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-5 w-5 text-grid-600" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <HomeSignInCard />
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">Step 1</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">Connect your Tesla</h3>
              <p className="mt-2 text-slate-600">Users authorize access once through a secure Tesla OAuth flow.</p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">Step 2</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">Plug in normally</h3>
              <p className="mt-2 text-slate-600">No departure time, urgency profile, or daily settings required.</p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">Step 3</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">Earn rewards</h3>
              <p className="mt-2 text-slate-600">Rewards appear when flexibility is used, simulated, or validated during pilot events.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Example pilot rewards</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">$18.42</p>
              </div>
              <div className="rounded-2xl bg-white p-3 text-grid-600">
                <WalletCards className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <PlugZap className="h-5 w-5 text-slate-500" />
                <p className="mt-2 text-xs text-slate-500">Shifted</p>
                <p className="text-lg font-semibold text-slate-950">112 kWh</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <Lock className="h-5 w-5 text-slate-500" />
                <p className="mt-2 text-xs text-slate-500">Reliability</p>
                <p className="text-lg font-semibold text-slate-950">91%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dashboard />

      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm text-slate-500 md:flex-row">
          <p>© 2026 GridPilot. Pilot MVP.</p>
          <p>Users should always retain manual override and clear consent controls.</p>
        </div>
      </footer>
    </main>
  );
}