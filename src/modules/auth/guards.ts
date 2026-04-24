import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/supabase/runtime";
interface UserRoleRow {
  id: string;
  role: "admin";
}

export async function requireAdminUser() {
  if (isAuthDisabled) {
    return { id: "mock-admin-user" } as unknown;
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRaw } = await supabase
    .from("users")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = (profileRaw ?? null) as UserRoleRow | null;

  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    const params = new URLSearchParams({ error: "Tu usuario no tiene permisos de admin" });
    redirect(`/login?${params.toString()}`);
  }

  return user;
}
