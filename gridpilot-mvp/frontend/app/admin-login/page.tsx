"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { loginAdminDemo } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = loginAdminDemo(username, password);
    if (!ok) setError("Invalid admin credentials.");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-grid-50 via-white to-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Admin
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-md px-6 py-10">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-grid-50 p-3 text-grid-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Admin Login</h1>
              <p className="text-sm text-slate-500">Sign in before opening admin dashboard</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Username</span>
              <input
                type="text"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-grid-600"
              />
            </label>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <button
              type="submit"
              className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Log in as admin
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
