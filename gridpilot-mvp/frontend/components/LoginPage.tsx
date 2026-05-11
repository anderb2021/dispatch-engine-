"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Car,
  Lock,
  Mail,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

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
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent(nextPath)}`;
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
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Car className="h-5 w-5" />
              Continue with Tesla
            </button>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              <GoogleIcon />
              Continue with Google
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