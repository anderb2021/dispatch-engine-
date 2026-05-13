/**
 * GridPilot auth helpers.
 *
 * User login/logout now uses Supabase Auth.
 * Buyer flow remains demo-mode for now.
 */
import { createClient } from "@/utils/supabase/client";

const BUYER_AUTH_KEY = "gridpilot_buyer_auth";

function normalizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/")) return "/dashboard";
  return nextPath;
}

export async function loginWithGoogle(nextPath?: string) {
  const next = normalizeNextPath(nextPath);
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      skipBrowserRedirect: true,
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) throw error;
  if (!data?.url) {
    throw new Error("Unable to start Google login.");
  }

  const url = new URL(data.url);
  if (!url.searchParams.get("apikey")) {
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (apiKey) {
      url.searchParams.set("apikey", apiKey);
    }
  }
  window.location.href = url.toString();
}

export async function loginWithEmail(email: string, password: string, nextPath?: string) {
  const next = normalizeNextPath(nextPath);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  window.location.href = next;
}

export async function logoutUser() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}

export async function loginAdminWithEmail(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return {
      ok: false,
      message: error.message || "Unable to sign in.",
    };
  }

  const userId = data.user?.id;
  if (!userId) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Missing user information from auth session.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Admin access not granted for this account.",
    };
  }

  window.location.href = "/admin";
  return { ok: true, message: "" };
}

export async function logoutAdmin() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/admin-login";
}

function setBuyerAuth(value: boolean) {
  localStorage.setItem(BUYER_AUTH_KEY, value ? "1" : "0");
  document.cookie = `${BUYER_AUTH_KEY}=${value ? "1" : "0"}; path=/; SameSite=Lax`;
}

export function loginBuyerDemo(username: string, password: string) {
  const isValid = username === "CLIENT" && password === "12345678";
  if (!isValid) return false;

  setBuyerAuth(true);
  window.location.href = "/buyers";
  return true;
}

export function logoutBuyerDemo() {
  setBuyerAuth(false);
  window.location.href = "/buyers-login";
}