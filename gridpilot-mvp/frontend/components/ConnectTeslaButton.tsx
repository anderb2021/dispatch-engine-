"use client";

import { ArrowRight } from "lucide-react";
import { trackButtonClick } from "@/lib/metaPixel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export function ConnectTeslaButton() {
  function connectTesla() {
    trackButtonClick("connect_tesla");
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent("/dashboard")}`;
  }

  return (
    <button
      onClick={connectTesla}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-grid-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500"
    >
      Connect Tesla
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}