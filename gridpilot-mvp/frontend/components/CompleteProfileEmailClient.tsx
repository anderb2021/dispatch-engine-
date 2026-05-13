"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function CompleteProfileEmailClient({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCurrentEmail() {
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
    }

    loadCurrentEmail();
  }, [nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter a valid email.");
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

      window.location.href = nextPath;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to save email. Please try again.";
      setError(message);
      setIsSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">Add your email</h1>
        <p className="mt-3 text-sm text-slate-600">
          We could not retrieve your email from Tesla. Add it here so your
          account and admin reporting stay complete.
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
