import { NextResponse, type NextRequest } from "next/server";
import { createClient as refreshSupabaseSession } from "@/utils/supabase/middleware";

const ADMIN_AUTH_COOKIE = "gridpilot_admin_auth";
const BUYER_AUTH_COOKIE = "gridpilot_buyer_auth";

function withSupabaseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...rest }) => {
    target.cookies.set(name, value, rest);
  });
  return target;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await refreshSupabaseSession(request);
  const { pathname } = request.nextUrl;
  const isDashboardPath = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isBuyerPath = pathname === "/buyers" || pathname.startsWith("/buyers/");

  if (!isDashboardPath && !isAdminPath && !isBuyerPath) return supabaseResponse;

  if (isDashboardPath) {
    if (user) return supabaseResponse;
    return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/login", request.url)));
  }

  const isAdminAuthenticated = request.cookies.get(ADMIN_AUTH_COOKIE)?.value === "1";
  if (isAdminPath) {
    if (isAdminAuthenticated) return supabaseResponse;
    return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/admin-login", request.url)));
  }

  const isBuyerAuthenticated = request.cookies.get(BUYER_AUTH_COOKIE)?.value === "1";
  if (isBuyerAuthenticated) return supabaseResponse;
  return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/buyers-login", request.url)));
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/buyers/:path*"],
};
