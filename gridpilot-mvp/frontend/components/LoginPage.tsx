"use client";

import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Lock,
  Mail,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { trackButtonClick, trackCompleteRegistration } from "@/lib/metaPixel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      trackButtonClick("sign_in_with_email");
      trackCompleteRegistration();
      await loginWithEmail(email, password, nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      trackButtonClick("continue_with_google");
      trackCompleteRegistration();
      await loginWithGoogle(nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  function handleTeslaLogin() {
    setErrorMessage(null);
    setIsLoading(true);
    trackButtonClick("continue_with_tesla");
    trackCompleteRegistration();
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent(nextPath)}&allow_charging_management=false`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <BrandLogo />

        <a
          href="/"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          Back home
        </a>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-grid-900 shadow-sm ring-1 ring-grid-100">
            <Sparkles className="h-4 w-4 text-grid-600" />
            Pilot access
          </div>

          <h1 className="mt-8 max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Sign in to manage your EV flexibility rewards.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Access your dashboard, connect your Tesla, review rewards, and adjust
            conservative flexibility preferences in one place.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Google login ready",
              "Tesla connection flow",
              "Reward dashboard access",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-5 w-5 text-grid-600" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <PlugZap className="h-6 w-6 text-grid-600" />
              <p className="mt-4 text-sm font-medium text-slate-500">Passive mode</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">Background</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <BatteryCharging className="h-6 w-6 text-grid-600" />
              <p className="mt-4 text-sm font-medium text-slate-500">First asset</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">EV charging</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <ShieldCheck className="h-6 w-6 text-grid-600" />
              <p className="mt-4 text-sm font-medium text-slate-500">User control</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">Override</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-slate-950 p-4 shadow-2xl">
          <div className="rounded-[1.5rem] bg-white p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">
                Sign in
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Access your dashboard
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use Google for the fastest pilot onboarding. Email login is included
                as a fallback.
              </p>
            </div>

            <button
              onClick={handleTeslaLogin}
              disabled={isLoading}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grid-600 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Image
                src="/tesla-logo.png"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
                aria-hidden="true"
              />
              {isLoading ? "Redirecting..." : "Sign in with Tesla"}
            </button>
            <div className="mt-2 space-y-0.5 text-center">
              <p className="text-xs text-slate-600">
                Secure OAuth connection. GridPilot never stores your Tesla password.
              </p>
              <p className="text-xs text-slate-500">
                No hardware required. Manual override always available.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="gsi-material-button mt-3 relative flex w-full items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white px-3 py-3 text-[14px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grid-600 focus-visible:ring-offset-2 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="gsi-material-button-state pointer-events-none absolute inset-0" />
              <div className="gsi-material-button-content-wrapper relative flex items-center justify-center gap-3">
                <div className="gsi-material-button-icon h-5 w-5 shrink-0">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    style={{ display: "block" }}
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google</span>
                <span className="sr-only">Sign in with Google</span>
              </div>
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                or
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-grid-600">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-grid-600">
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500"
              >
                {isLoading ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {errorMessage ? (
              <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                <p className="font-semibold">Login failed</p>
                <p className="mt-1">{errorMessage}</p>
              </div>
            ) : null}

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              By continuing, users should agree to GridPilot pilot terms, privacy policy,
              Tesla connection permissions, and reward program terms.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}