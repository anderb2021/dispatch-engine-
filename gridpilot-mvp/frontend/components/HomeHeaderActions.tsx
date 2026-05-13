"use client";

import { trackButtonClick, trackCompleteRegistration } from "@/lib/metaPixel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export function HomeHeaderActions() {
  function onJoinPilot() {
    trackButtonClick("join_pilot");
    trackCompleteRegistration();
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent("/dashboard")}&allow_charging_management=false`;
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200/80 backdrop-blur">
      <a
        href="#signin"
        className="inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Log in
      </a>
      <button
        onClick={onJoinPilot}
        className="inline-flex h-10 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        Join pilot
      </button>
    </div>
  );
}
