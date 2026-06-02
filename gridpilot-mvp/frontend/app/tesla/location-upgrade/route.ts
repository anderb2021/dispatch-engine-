import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));
  }

  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/dashboard";

  return NextResponse.redirect(
    `${API_BASE}/auth/tesla/location-upgrade?user_id=${encodeURIComponent(user.id)}&next=${encodeURIComponent(next)}`
  );
}
