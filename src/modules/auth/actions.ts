"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/supabase/runtime";
interface UserRoleRow {
  role: "admin";
}
function loginErrorRedirect(message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/login?${params.toString()}`);
}
function loginNoticeRedirect(message: string): never {
  const params = new URLSearchParams({ notice: message });
  redirect(`/login?${params.toString()}`);
}

export async function loginAction(formData: FormData) {
  if (isAuthDisabled) {
    redirect("/dashboard");
  }
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    loginErrorRedirect("Completa el correo");
  }

  const supabase = createClient();
  const { data: profileRaw } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .maybeSingle();
  const profile = (profileRaw ?? null) as UserRoleRow | null;

  if (!profile || profile.role !== "admin") {
    loginErrorRedirect("Tu usuario no tiene permisos de admin");
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`,
    },
  });

  if (error) {
    loginErrorRedirect("No se pudo enviar el enlace de acceso");
  }

  loginNoticeRedirect("Te enviamos un enlace de acceso a tu correo");
}

export async function logoutAction() {
  if (isAuthDisabled) {
    redirect("/login");
  }
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
