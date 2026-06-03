"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function UpgradeLocationClient({
  token,
  nextPath,
  initialError,
}: {
  token?: string;
  nextPath: string;
  initialError?: string;
}) {
  const [error, setError] = useState<string | null>(initialError || null);

  useEffect(() => {
    if (initialError || error) return;
    if (!token) {
      setError("This link is missing a security token. Use the link from your GridPilot email.");
      return;
    }

    const target = `${API_BASE}/auth/tesla/upgrade-link?token=${encodeURIComponent(token)}&next=${encodeURIComponent(nextPath)}`;
    window.location.href = target;
  }, [token, nextPath, initialError, error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-grid-50 text-grid-600 ring-1 ring-grid-100">
          <MapPin className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-semibold text-slate-950">
          Verify charging location
        </h1>
        {error ? (
          <p className="mt-4 text-center text-sm text-rose-700">{error}</p>
        ) : (
          <>
            <p className="mt-4 text-center text-sm text-slate-600">
              Redirecting you to Tesla to enable charging-location access for flexibility
              program eligibility. After you approve all integrations, you will return to your
              GridPilot account automatically.
            </p>
            <p className="mt-3 text-center text-xs text-slate-500">
              We only use charging-location data for utility and marketplace qualification.
              GridPilot does not track driving routes.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
