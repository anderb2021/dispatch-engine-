import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserDashboard } from "@/components/UserDashboard";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: summary }, { data: vehicleRows }, { data: snapshotRows }, { data: teslaRows }] =
    await Promise.all([
      supabase.from("user_dashboard_summary").select("*").eq("user_id", user.id).limit(1),
      supabase.from("vehicles").select("*").eq("user_id", user.id).eq("is_active", true).limit(1),
      supabase
        .from("vehicle_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("captured_at", { ascending: false })
        .limit(1),
      supabase
        .from("tesla_connections")
        .select("id,status")
        .eq("user_id", user.id)
        .eq("status", "connected")
        .limit(1),
    ]);

  return (
    <UserDashboard
      dashboardSummary={summary?.[0] ?? null}
      vehicle={vehicleRows?.[0] ?? null}
      latestSnapshot={snapshotRows?.[0] ?? null}
      hasTeslaConnection={Boolean(teslaRows?.length)}
    />
  );
}
