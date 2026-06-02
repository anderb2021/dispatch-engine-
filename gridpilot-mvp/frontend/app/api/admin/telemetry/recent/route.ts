import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";

type RecentPayload = {
  snapshots: Array<Record<string, unknown>>;
  count: number;
};

export async function GET() {
  const result = await proxyAdminGet<RecentPayload>("/admin/telemetry/recent");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
