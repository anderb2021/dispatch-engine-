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
