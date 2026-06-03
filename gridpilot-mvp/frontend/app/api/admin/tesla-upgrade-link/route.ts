import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";

function resolvePublicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost.split(",")[0].trim()}`;
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return url.origin;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl.replace(/\/$/, "");
  }
  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return vercelHost.startsWith("http") ? vercelHost.replace(/\/$/, "") : `https://${vercelHost}`;
  }
  return "https://www.joingridpilot.com";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const next = url.searchParams.get("next") || "/dashboard";

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const result = await proxyAdminGet<{
    user_id: string;
    upgrade_url: string;
    expires_in_days: number;
    token?: string;
  }>(
    `/admin/tesla/upgrade-link?user_id=${encodeURIComponent(userId)}&next=${encodeURIComponent(next)}`
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const origin = resolvePublicOrigin(request);
  const backendUrl = new URL(result.data.upgrade_url);
  const token = backendUrl.searchParams.get("token");
  const nextPath = backendUrl.searchParams.get("next") || next;

  if (token) {
    result.data.upgrade_url = `${origin}/tesla/upgrade-location?token=${encodeURIComponent(token)}&next=${encodeURIComponent(nextPath)}`;
    result.data.token = token;
  }

  return NextResponse.json(result.data);
}
