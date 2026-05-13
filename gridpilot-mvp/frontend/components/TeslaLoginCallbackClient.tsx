"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { trackCompleteRegistration } from "@/lib/metaPixel";

export function TeslaLoginCallbackClient({
  accessToken,
  refreshToken,
  nextPath,
  callbackError,
}: {
  accessToken?: string;
  refreshToken?: string;
  nextPath: string;
  callbackError?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finishTeslaLogin() {
      const params = new URLSearchParams(window.location.search);
      const resolvedAccessToken = accessToken || params.get("access_token") || undefined;
      const resolvedRefreshToken = refreshToken || params.get("refresh_token") || undefined;
      const resolvedError = callbackError || params.get("error") || undefined;

      if (resolvedError) {
        setError(resolvedError);
        return;
      }

      if (!resolvedAccessToken || !resolvedRefreshToken) {
        setError("Tesla login callback is missing a session token.");
        return;
      }
      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: resolvedAccessToken,
        refresh_token: resolvedRefreshToken,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userId = user?.id;
      if (!userId) {
        setError("Unable to load profile after Tesla login.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .limit(1)
        .maybeSingle();
      if (profileError) {
        setError(profileError.message);
        return;
      }

      const profileEmail = profile?.email;
      const authEmail = user?.email;
      const needsEmailCapture =
        isMissingOrPlaceholderEmail(profileEmail) &&
        isMissingOrPlaceholderEmail(authEmail);

      if (needsEmailCapture) {
        window.location.href = `/auth/complete-profile?next=${encodeURIComponent(nextPath)}`;
        return;
      }
      trackCompleteRegistration();
      window.location.href = nextPath;
    }

    finishTeslaLogin();
  }, [accessToken, refreshToken, nextPath, callbackError]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">Finishing Tesla sign-in...</h1>
        {error ? (
          <p className="mt-4 text-sm text-rose-700">
            Tesla login failed: {error}. Please retry from the login page.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            We are creating your GridPilot session and linking your Tesla account.
          </p>
        )}
      </div>
    </main>
  );
}

function isMissingOrPlaceholderEmail(value?: string | null) {
  if (!value || !value.trim()) return true;
  return value.endsWith("@tesla.gridpilot.local");
}
