import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";
import type { TelemetrySummary } from "@/lib/telemetryAnalytics";

export async function GET() {
  const result = await proxyAdminGet<TelemetrySummary>("/admin/telemetry/summary");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
