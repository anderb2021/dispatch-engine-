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
    return NextResponse.redirect(new URL("/login?next=/tesla/connect", request.url));
  }

  return NextResponse.redirect(
    `${API_BASE}/auth/tesla/redirect?user_id=${encodeURIComponent(user.id)}&allow_charging_management=true`
  );
}
