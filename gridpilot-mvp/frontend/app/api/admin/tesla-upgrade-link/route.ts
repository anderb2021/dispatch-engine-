import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";

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
  }>(
    `/admin/tesla/upgrade-link?user_id=${encodeURIComponent(userId)}&next=${encodeURIComponent(next)}`
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
