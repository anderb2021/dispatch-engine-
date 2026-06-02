"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PJM_UTILITIES } from "@/lib/marketplaceQualification";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
];

export function CompleteProfileEmailClient({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [utility, setUtility] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
        return;
      }

      const existing = user.email;
      if (existing && !isPlaceholderTeslaEmail(existing)) {
        setEmail(existing);
      }

      try {
        const response = await fetch("/api/me/marketplace-qualification");
        if (response.ok) {
          const data = (await response.json()) as {
            zip_code?: string | null;
            state?: string | null;
            utility_provider?: string | null;
            address_line1?: string | null;
            address_line2?: string | null;
            city?: string | null;
          };
          if (data.zip_code) setZipCode(data.zip_code);
          if (data.state) setState(data.state);
          if (data.utility_provider) setUtility(data.utility_provider);
          if (data.address_line1) setAddressLine1(data.address_line1);
          if (data.address_line2) setAddressLine2(data.address_line2);
          if (data.city) setCity(data.city);
        }
      } catch {
        // Optional prefill; form still works offline from API failure.
      }
    }

    loadProfile();
  }, [nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedZip = zipCode.trim();
    const normalizedState = state.trim().toUpperCase();
    const normalizedCity = city.trim();
    const normalizedStreet = addressLine1.trim();

    if (!normalizedEmail) {
      setError("Please enter a valid email.");
      return;
    }
    if (!normalizedStreet || !normalizedCity || !normalizedState || !normalizedZip) {
      setError("Please enter your charging address (street, city, state, and ZIP).");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Please sign in again to continue.");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ email: normalizedEmail })
        .eq("id", user.id);
      if (profileError) {
        throw new Error(profileError.message || "Could not save email.");
      }

      const qualificationResponse = await fetch("/api/me/marketplace-qualification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip_code: normalizedZip,
          state: normalizedState,
          city: normalizedCity,
          address_line1: normalizedStreet,
          address_line2: addressLine2.trim() || undefined,
          utility_provider: utility.trim() || undefined,
          iso_rto: "PJM",
        }),
      });
      if (!qualificationResponse.ok) {
        const payload = (await qualificationResponse.json()) as { error?: string };
        throw new Error(
          payload.error ||
            "Saved email but could not save address. You can update it on your dashboard."
        );
      }

      window.location.href = nextPath;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to save profile. Please try again.";
      setError(message);
      setIsSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">Complete your profile</h1>
        <p className="mt-3 text-sm text-slate-600">
          We could not retrieve your email from Tesla. Add your contact details and primary
          charging address so we can verify utility program and marketplace eligibility.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Street address</span>
            <input
              type="text"
              required
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              placeholder="123 Main St"
              autoComplete="street-address"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Apt, unit, or suite <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              type="text"
              value={addressLine2}
              onChange={(event) => setAddressLine2(event.target.value)}
              placeholder="Apt 4B"
              autoComplete="address-line2"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">City</span>
              <input
                type="text"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Cherry Hill"
                autoComplete="address-level2"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">State</span>
              <select
                required
                value={state}
                onChange={(event) => setState(event.target.value)}
                autoComplete="address-level1"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
              >
                <option value="">Select</option>
                {US_STATES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">ZIP code</span>
            <input
              type="text"
              required
              inputMode="numeric"
              value={zipCode}
              onChange={(event) => setZipCode(event.target.value)}
              placeholder="08003"
              autoComplete="postal-code"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Utility provider <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <select
              value={utility}
              onChange={(event) => setUtility(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
            >
              <option value="">Select your utility</option>
              {PJM_UTILITIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            {isSaving ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

function isPlaceholderTeslaEmail(value: string) {
  return value.endsWith("@tesla.gridpilot.local");
}
