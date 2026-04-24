import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/runtime";
import type { Database } from "@/types/database";

export function createClient() {
  if (!isSupabaseConfigured || !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase browser client requested but environment is not configured. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or use local mock mode.",
    );
  }
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
