"use client";

import { MapPin } from "lucide-react";
import type { MarketplaceQualification } from "@/lib/marketplaceQualification";

export function MarketplaceEligibilityBanner({
  qualification,
}: {
  qualification: MarketplaceQualification;
}) {
  if (!qualification.needs_location_scope) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-grid-200 bg-gradient-to-r from-grid-50 to-white p-5 shadow-sm ring-1 ring-grid-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="rounded-2xl bg-white p-3 text-grid-600 shadow-sm ring-1 ring-slate-200">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Unlock flexibility program eligibility
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              GridPilot is expanding participation in EV flexibility programs. Verify your
              charging location to determine eligibility for available utility incentives and
              marketplace rewards.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              We only use charging-location data for utility and marketplace qualification.
              GridPilot does not track driving routes.
            </p>
          </div>
        </div>
        <a
          href="/tesla/location-upgrade?next=/dashboard"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-grid-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500"
        >
          Verify charging location
        </a>
      </div>
    </div>
  );
}
