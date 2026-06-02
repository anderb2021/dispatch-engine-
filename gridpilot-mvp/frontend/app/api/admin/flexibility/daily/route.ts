import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";

type DailyPayload = {
  days: Array<Record<string, unknown>>;
};

export async function GET() {
  const result = await proxyAdminGet<DailyPayload>("/admin/flexibility/daily");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
