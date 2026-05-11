"use client";

import { trackButtonClick } from "@/lib/metaPixel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export function HomeHeaderActions() {
  function onJoinPilot() {
    trackButtonClick("join_pilot");
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent("/dashboard")}`;
  }

  return (
    <div className="flex items-center gap-3">
      <a
        href="#signin"
        className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        Log in
      </a>
      <button
        onClick={onJoinPilot}
        className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
      >
        Join pilot
      </button>
    </div>
  );
}
