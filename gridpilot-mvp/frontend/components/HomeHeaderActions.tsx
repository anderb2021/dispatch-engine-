"use client";

import { trackButtonClick } from "@/lib/metaPixel";

export function HomeHeaderActions() {
  function onJoinPilot() {
    trackButtonClick("join_pilot");
    window.location.href = "/signup";
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
