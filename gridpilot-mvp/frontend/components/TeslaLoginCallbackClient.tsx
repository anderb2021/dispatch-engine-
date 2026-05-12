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
