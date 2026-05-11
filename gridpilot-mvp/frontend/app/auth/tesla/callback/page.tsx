"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function TeslaLoginCallbackPage() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const nextPath = params.get("next") || "/dashboard";

    async function finishTeslaLogin() {
      if (!accessToken || !refreshToken) {
        setError("Tesla login callback is missing a session token.");
        return;
      }
      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      window.location.href = nextPath;
    }

    finishTeslaLogin();
  }, [params]);

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
