"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import {
  PJM_UTILITIES,
  type MarketplaceQualification,
} from "@/lib/marketplaceQualification";

export function MarketplaceQualificationCard({
  initial,
  onUpdated,
}: {
  initial: MarketplaceQualification;
  onUpdated?: (next: MarketplaceQualification) => void;
}) {
  const [zipCode, setZipCode] = useState(initial.zip_code ?? "");
  const [utility, setUtility] = useState(initial.utility_provider ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [pjmZone, setPjmZone] = useState(initial.pjm_zone ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/me/marketplace-qualification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip_code: zipCode.trim(),
          utility_provider: utility.trim(),
          state: state.trim() || undefined,
          pjm_zone: pjmZone.trim() || undefined,
          iso_rto: "PJM",
        }),
      });
      const payload = (await response.json()) as MarketplaceQualification & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Save failed (${response.status})`);
      }
      setMessage("Program details saved.");
      onUpdated?.(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold text-slate-950">Marketplace qualification</h2>
      <p className="mt-1 text-sm text-slate-500">
        Add your primary charging ZIP and utility to qualify via PJM territory when Tesla
        charging-location verification is not available yet.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Primary charging ZIP</span>
          <input
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="08003"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-grid-600 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Utility provider</span>
          <select
            value={utility}
            onChange={(e) => setUtility(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-grid-600 focus:ring-2"
          >
            <option value="">Select utility</option>
            {PJM_UTILITIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">State (optional)</span>
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="NJ"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-grid-600 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">PJM zone (optional)</span>
          <input
            value={pjmZone}
            onChange={(e) => setPjmZone(e.target.value)}
            placeholder="AE"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-grid-600 focus:ring-2"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>
          Status:{" "}
          <strong className="text-slate-900">
            {initial.qualification_status ?? "Pending"}
          </strong>
        </span>
        {initial.vehicle_location_scope_granted ? (
          <span className="rounded-full bg-grid-50 px-2.5 py-1 text-xs font-semibold text-grid-800">
            Tesla charging location enabled
          </span>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-sm text-grid-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save program details"}
      </button>
    </div>
  );
}
