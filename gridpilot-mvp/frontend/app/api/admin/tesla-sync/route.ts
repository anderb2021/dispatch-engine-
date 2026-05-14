import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type SyncRequest = {
  mode?: "all" | "user";
  userId?: string;
  includeVehicles?: boolean;
  includeTelemetry?: boolean;
};

type UserSyncResult = {
  userId: string;
  vehiclesOk: boolean;
  telemetryOk: boolean;
  error?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: SyncRequest = {};
  try {
    payload = (await request.json()) as SyncRequest;
  } catch {
    payload = {};
  }

  const mode = payload.mode === "all" ? "all" : "user";
  const includeVehicles = payload.includeVehicles !== false;
  const includeTelemetry = payload.includeTelemetry !== false;

  if (!includeVehicles && !includeTelemetry) {
    return NextResponse.json(
      { error: "At least one sync target must be selected." },
      { status: 400 }
    );
  }

  let userIds: string[] = [];
  if (mode === "all") {
    const { data: connections } = await supabase
      .from("tesla_connections")
      .select("user_id,status")
      .eq("status", "connected")
      .limit(5000);
    userIds = Array.from(
      new Set(
        (connections ?? [])
          .map((row) => String(row.user_id || ""))
          .filter(Boolean)
      )
    );
  } else {
    const targetUserId = String(payload.userId || "").trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "Missing userId for single-user sync." }, { status: 400 });
    }
    userIds = [targetUserId];
  }

  if (!userIds.length) {
    return NextResponse.json({
      mode,
      includeVehicles,
      includeTelemetry,
      syncedUsers: 0,
      successCount: 0,
      failedCount: 0,
      results: [],
      message: "No connected Tesla users found.",
    });
  }

  const results: UserSyncResult[] = [];
  for (const userId of userIds) {
    let vehiclesOk = !includeVehicles;
    let telemetryOk = !includeTelemetry;
    let errorMessage: string | undefined;

    try {
      if (includeVehicles) {
        const response = await fetch(
          `${API_BASE}/tesla/vehicles?user_id=${encodeURIComponent(userId)}`,
          { method: "GET", cache: "no-store" }
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Vehicles sync failed (${response.status}): ${text}`);
        }
        vehiclesOk = true;
      }

      if (includeTelemetry) {
        const response = await fetch(
          `${API_BASE}/tesla/poll-telemetry?user_id=${encodeURIComponent(userId)}`,
          { method: "POST", cache: "no-store" }
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Telemetry sync failed (${response.status}): ${text}`);
        }
        telemetryOk = true;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Unknown sync error.";
    }

    results.push({
      userId,
      vehiclesOk,
      telemetryOk,
      error: errorMessage,
    });
  }

  const successCount = results.filter((item) => item.vehiclesOk && item.telemetryOk).length;
  const failedCount = results.length - successCount;

  return NextResponse.json({
    mode,
    includeVehicles,
    includeTelemetry,
    syncedUsers: results.length,
    successCount,
    failedCount,
    results,
  });
}
