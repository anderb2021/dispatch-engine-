"use client";

import Image from "next/image";
import { trackButtonClick, trackCompleteRegistration } from "@/lib/metaPixel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export function ConnectTeslaButton() {
  function connectTesla() {
    trackButtonClick("connect_tesla");
    trackCompleteRegistration();
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent("/dashboard")}&allow_charging_management=false`;
  }

  return (
    <div className="inline-flex w-full max-w-sm flex-col items-center gap-2 text-center">
      <button
        onClick={connectTesla}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grid-600 focus-visible:ring-offset-2 active:scale-[0.99] sm:w-auto sm:min-w-[250px]"
      >
        <Image
          src="/tesla-logo.png"
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
          aria-hidden="true"
        />
        Connect Your Tesla
      </button>
      <div className="space-y-0.5 text-center">
        <p className="text-xs text-slate-600">
          Secure OAuth connection. GridPilot never stores your Tesla password.
        </p>
        <p className="text-xs text-slate-500">
          No hardware required. Manual override always available.
        </p>
      </div>
    </div>
  );
}