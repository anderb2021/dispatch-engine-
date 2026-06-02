import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";
import type { AdminMarketplaceSummary } from "@/lib/marketplaceQualification";

export async function GET() {
  const result = await proxyAdminGet<AdminMarketplaceSummary>(
    "/admin/marketplace-qualification/summary"
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
