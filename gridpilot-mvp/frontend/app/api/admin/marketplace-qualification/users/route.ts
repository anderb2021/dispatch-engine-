import { NextResponse } from "next/server";
import { proxyAdminGet } from "@/lib/adminApi";

export async function GET() {
  const result = await proxyAdminGet<{ users: unknown[] }>(
    "/admin/marketplace-qualification/users"
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
