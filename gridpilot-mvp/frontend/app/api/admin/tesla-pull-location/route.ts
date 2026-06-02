import { NextResponse } from "next/server";
import { proxyAdminPost } from "@/lib/adminApi";

type PullLocationRequest = {
  mode?: "all" | "user";
  userId?: string;
  wake?: boolean;
};

type VehicleLocationResult = {
  vehicle_id?: string;
  tesla_vehicle_id?: string;
  display_name?: string;
  woke?: boolean;
  plugged_in?: boolean | null;
  tesla_latitude?: number | null;
  tesla_longitude?: number | null;
  stored_latitude?: number | null;
  stored_longitude?: number | null;
  location_stored?: boolean;
  note?: string | null;
  error?: string | null;
};

type PullLocationPayload = {
  user_id?: string;
  has_location_scope?: boolean;
  vehicles?: VehicleLocationResult[];
  errors?: string[];
};

export async function POST(request: Request) {
  let payload: PullLocationRequest = {};
  try {
    payload = (await request.json()) as PullLocationRequest;
  } catch {
    payload = {};
  }

  const wake = payload.wake !== false;
  const mode = payload.mode === "all" ? "all" : "user";

  if (mode === "user") {
    const userId = String(payload.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    }
    const query = new URLSearchParams({ user_id: userId, wake: String(wake) });
    const result = await proxyAdminPost<PullLocationPayload>(
      `/admin/tesla/pull-location?${query.toString()}`
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  }

  // mode === "all": fan out via Supabase connected users (same pattern as tesla-sync).
  const { cookies } = await import("next/headers");
  const { createClient } = await import("@/utils/supabase/server");
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

  const { data: connections } = await supabase
    .from("tesla_connections")
    .select("user_id,status")
    .eq("status", "connected")
    .limit(5000);

  const userIds = Array.from(
    new Set(
      (connections ?? [])
        .map((row) => String(row.user_id || ""))
        .filter(Boolean)
    )
  );

  const allVehicles: VehicleLocationResult[] = [];
  const errors: string[] = [];
  let hasLocationScope = false;

  for (const userId of userIds) {
    const query = new URLSearchParams({ user_id: userId, wake: String(wake) });
    const result = await proxyAdminPost<PullLocationPayload>(
      `/admin/tesla/pull-location?${query.toString()}`
    );
    if (!result.ok) {
      errors.push(`${userId}: ${result.error}`);
      continue;
    }
    if (result.data.has_location_scope) {
      hasLocationScope = true;
    }
    for (const vehicle of result.data.vehicles ?? []) {
      allVehicles.push({ ...vehicle, vehicle_id: vehicle.vehicle_id ?? userId });
    }
    for (const err of result.data.errors ?? []) {
      errors.push(`${userId}: ${err}`);
    }
  }

  return NextResponse.json({
    users_polled: userIds.length,
    has_location_scope: hasLocationScope,
    vehicles: allVehicles,
    errors,
  });
}
