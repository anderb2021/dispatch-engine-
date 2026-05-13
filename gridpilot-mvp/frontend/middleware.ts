import { NextResponse, type NextRequest } from "next/server";
import { createClient as refreshSupabaseSession } from "@/utils/supabase/middleware";

const BUYER_AUTH_COOKIE = "gridpilot_buyer_auth";

function withSupabaseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...rest }) => {
    target.cookies.set(name, value, rest);
  });
  return target;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await refreshSupabaseSession(request);
  const { pathname } = request.nextUrl;
  const isDashboardPath = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isBuyerPath = pathname === "/buyers" || pathname.startsWith("/buyers/");

  if (!isDashboardPath && !isAdminPath && !isBuyerPath) return supabaseResponse;

  if (isDashboardPath) {
    if (user) return supabaseResponse;
    return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/login", request.url)));
  }

  if (isAdminPath) {
    if (!user) {
      return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/admin-login", request.url)));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();
    if (profile?.role === "admin") return supabaseResponse;
    return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/admin-login", request.url)));
  }

  const isBuyerAuthenticated = request.cookies.get(BUYER_AUTH_COOKIE)?.value === "1";
  if (isBuyerAuthenticated) return supabaseResponse;
  return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL("/buyers-login", request.url)));
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/buyers/:path*"],
};
