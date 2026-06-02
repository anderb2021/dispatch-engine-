import { NextResponse } from "next/server";
import { proxyUserGet, proxyUserPost } from "@/lib/adminApi";

export async function GET() {
  const result = await proxyUserGet<Record<string, unknown>>(
    "/me/marketplace-qualification"
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = await proxyUserPost<Record<string, unknown>>(
    "/me/marketplace-qualification",
    body
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
