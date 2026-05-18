"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Lock, Mail, Phone, User } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { signupWithEmail } from "@/lib/auth";
import { trackButtonClick } from "@/lib/metaPixel";

export function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    trackButtonClick("signup_with_email");
    const result = await signupWithEmail({
      fullName,
      email,
      phoneNumber,
      password,
    });
    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      setSuccessMessage(result.message);
      setIsSubmitting(false);
      return;
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <BrandLogo />
        <a
          href="/login"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          Already have an account?
        </a>
      </header>

      <section className="mx-auto max-w-md px-6 pb-16 pt-8">
        <div className="rounded-[2rem] bg-slate-950 p-4 shadow-2xl">
          <div className="rounded-[1.5rem] bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-grid-600">Sign up</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Create your GridPilot account
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start with basic account details, then connect Tesla after signup.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Full name</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-grid-600">
                  <User className="h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

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
                <span className="text-sm font-medium text-slate-700">Phone number</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-grid-600">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+1 (555) 123-4567"
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
                    placeholder="At least 8 characters"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Confirm password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-grid-600">
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-900">{error}</div>
              ) : null}
              {successMessage ? (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                  {successMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-grid-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-grid-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Creating account..." : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
