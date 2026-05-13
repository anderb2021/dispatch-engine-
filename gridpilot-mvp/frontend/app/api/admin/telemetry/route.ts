import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Row = Record<string, unknown>;

export async function GET() {
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

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    { data: profiles = [] },
    { data: vehicles = [] },
    { data: snapshots = [] },
    { data: rewards = [] },
    { data: dispatchEvents = [] },
    { data: summaryRows = [] },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("vehicles")
      .select("id,user_id,display_name,model,state,controllable_kw,is_active")
      .eq("is_active", true)
      .limit(5000),
    supabase
      .from("vehicle_snapshots")
      .select("id,user_id,battery_level,charging_state,plugged_in,charger_power_kw,captured_at")
      .order("captured_at", { ascending: false })
      .limit(5000),
    supabase
      .from("reward_ledger")
      .select("id,user_id,amount,created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("dispatch_events")
      .select("id,event_type,status,verified_kw,verified_kwh_shifted,reward_amount,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("user_dashboard_summary")
      .select("user_id,dispatch_reliability,flexibility_score")
      .limit(5000),
  ]);

  const profileRows = (profiles ?? []) as Row[];
  const vehicleRows = (vehicles ?? []) as Row[];
  const snapshotRows = (snapshots ?? []) as Row[];
  const rewardRows = (rewards ?? []) as Row[];
  const dispatchEventRows = (dispatchEvents ?? []) as Row[];
  const summaryDataRows = (summaryRows ?? []) as Row[];

  const activeUsers = new Set(
    profileRows
      .map((row: Row) => String(row.id || ""))
      .filter(Boolean)
  ).size;
  const signupsTotal = activeUsers;
  const signupsLast7Days = profileRows.filter((row: Row) => isAfter(row.created_at, weekStart)).length;
  const connectedVehicles = vehicleRows.length;
  const controllableKw = sum(vehicleRows, "controllable_kw");
  const flexibleKwh = snapshotRows
    .filter((row: Row) => Boolean(row.plugged_in))
    .reduce((acc, row) => acc + toNumber(row.charger_power_kw), 0);

  const dispatchReliability = avg(
    summaryDataRows
      .map((row: Row) => toNumber(row.dispatch_reliability))
      .filter((value) => Number.isFinite(value))
  );
  const avgFlexScore = avg(
    summaryDataRows
      .map((row: Row) => toNumber(row.flexibility_score))
      .filter((value) => Number.isFinite(value))
  );
  const monthlyRewardLiability = rewardRows
    .filter((row: Row) => isAfter(row.created_at, monthStart))
    .reduce((acc, row) => acc + toNumber(row.amount), 0);
  const shiftedKwhMonth = dispatchEventRows
    .filter((row: Row) => isAfter(row.created_at, monthStart))
    .reduce((acc, row) => acc + toNumber(row.verified_kwh_shifted), 0);

  const latestSnapshotByUser = new Map<string, Row>();
  for (const row of snapshotRows) {
    const userId = String(row.user_id || "");
    if (userId && !latestSnapshotByUser.has(userId)) latestSnapshotByUser.set(userId, row);
  }

  const vehicleByUser = new Map<string, Row>();
  for (const row of vehicleRows) {
    const userId = String(row.user_id || "");
    if (userId && !vehicleByUser.has(userId)) vehicleByUser.set(userId, row);
  }

  const summaryByUser = new Map<string, Row>();
  for (const row of summaryDataRows) {
    const userId = String(row.user_id || "");
    if (userId) summaryByUser.set(userId, row);
  }

  const rewardByUserThisMonth = new Map<string, number>();
  for (const row of rewardRows) {
    const userId = String(row.user_id || "");
    if (!userId || !isAfter(row.created_at, monthStart)) continue;
    rewardByUserThisMonth.set(userId, (rewardByUserThisMonth.get(userId) || 0) + toNumber(row.amount));
  }

  const users = profileRows.slice(0, 200).map((row) => {
    const userId = String(row.id || "");
    const vehicle = vehicleByUser.get(userId) || {};
    const snapshot = latestSnapshotByUser.get(userId) || {};
    const summary = summaryByUser.get(userId) || {};

    return {
      id: toAdminUserId(userId),
      name: displayName(row.full_name, row.email),
      vehicle: String(vehicle.display_name || vehicle.model || "No vehicle"),
      battery: Math.round(toNumber(snapshot.battery_level)),
      status: String(snapshot.charging_state || vehicle.state || "Unknown"),
      flexScore: Math.round(toNumber(summary.flexibility_score)),
      reliability: Math.round(toNumber(summary.dispatch_reliability)),
      rewards: round2(rewardByUserThisMonth.get(userId) || 0),
      controllableKw: round1(toNumber(vehicle.controllable_kw)),
    };
  });

  const events = dispatchEventRows.slice(0, 20).map((row, idx) => ({
    id: String(row.id || `D-${idx + 1}`),
    time: String(row.created_at || "Recent"),
    type: String(row.event_type || "Dispatch event"),
    users: activeUsers,
    kw: round1(toNumber(row.verified_kw)),
    kwh: round1(toNumber(row.verified_kwh_shifted)),
    rewards: round2(toNumber(row.reward_amount)),
    status: String(row.status || "Completed"),
  }));

  return NextResponse.json({
    network: {
      activeUsers,
      signupsTotal,
      signupsLast7Days,
      connectedVehicles,
      controllableKw: round1(controllableKw),
      flexibleKwh: round1(flexibleKwh),
      dispatchReliability: Math.round(dispatchReliability),
      monthlyRewardLiability: round2(monthlyRewardLiability),
      shiftedKwhMonth: round1(shiftedKwhMonth),
      avgFlexScore: Math.round(avgFlexScore),
    },
    users,
    events,
    generatedAt: new Date().toISOString(),
  });
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(rows: Row[], key: string): number {
  return rows.reduce((acc, row) => acc + toNumber(row[key]), 0);
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isAfter(value: unknown, threshold: Date): boolean {
  const date = asDate(value);
  return Boolean(date && date >= threshold);
}

function displayName(fullName: unknown, email: unknown): string {
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof email === "string" && email.includes("@")) {
    const local = email.split("@", 1)[0];
    return local.replace(/[._-]+/g, " ").trim() || "GridPilot User";
  }
  return "GridPilot User";
}

function toAdminUserId(userId: string): string {
  const token = userId.replace(/-/g, "").toUpperCase();
  return token ? `U-${token.slice(0, 8)}` : "U-UNKNOWN";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
