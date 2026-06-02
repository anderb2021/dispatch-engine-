import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type AdminApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/** Verify the caller is an admin and return their Supabase access token. */
export async function requireAdminSession(): Promise<
  { userId: string; accessToken: string } | { error: string; status: number }
> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { userId: user.id, accessToken: session.access_token };
}

/** Proxy a GET request to the FastAPI backend with admin bearer auth. */
export async function proxyAdminGet<T>(path: string): Promise<AdminApiResult<T>> {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      error: text || `Request failed (${response.status})`,
    };
  }

  const data = (await response.json()) as T;
  return { ok: true, data };
}

/** Proxy a POST request to the FastAPI backend with admin bearer auth. */
export async function proxyAdminPost<T>(
  path: string,
  body?: Record<string, unknown>
): Promise<AdminApiResult<T>> {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      error: text || `Request failed (${response.status})`,
    };
  }

  const data = (await response.json()) as T;
  return { ok: true, data };
}
