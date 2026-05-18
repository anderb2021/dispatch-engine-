"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { ArrowRight, Mail, Lock } from "lucide-react";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth";
import { trackButtonClick, trackCompleteRegistration } from "@/lib/metaPixel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export function HomeSignInCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      trackButtonClick("sign_in_with_email");
      trackCompleteRegistration();
      await loginWithEmail(email, password, "/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  async function onGoogleLogin() {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      trackButtonClick("continue_with_google");
      trackCompleteRegistration();
      await loginWithGoogle("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  function onTeslaLogin() {
    setErrorMessage(null);
    setIsLoading(true);
    trackButtonClick("continue_with_tesla");
    trackCompleteRegistration();
    window.location.href = `${API_BASE}/auth/tesla/login/redirect?next=${encodeURIComponent("/dashboard")}&allow_charging_management=false`;
  }

  return (
    <div id="signin" className="rounded-[2rem] bg-slate-950 p-4 shadow-2xl">
      <div className="rounded-[1.5rem] bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">Sign in</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Access your dashboard
        </h2>

        <button
          onClick={onTeslaLogin}
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
          onClick={onGoogleLogin}
          disabled={isLoading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          Continue with Google
        </button>

        <form onSubmit={onEmailSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm text-slate-950 outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="sr-only">Password</span>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Lock className="h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full bg-transparent text-sm text-slate-950 outline-none"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-grid-500"
          >
            {isLoading ? "Signing in..." : "Sign in with email"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
