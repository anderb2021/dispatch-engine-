import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function SupabaseTestPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from("todos").select();

  return (
    <ul className="mx-auto max-w-3xl space-y-2 p-8">
      {todos?.map((todo: { id: string; name: string }) => (
        <li key={todo.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          {todo.name}
        </li>
      ))}
    </ul>
  );
}
