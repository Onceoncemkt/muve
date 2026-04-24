export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const isLocalMockMode = process.env.NODE_ENV === "development" && !isSupabaseConfigured;

export const isAuthDisabled =
  process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" ||
  process.env.NODE_ENV === "development" ||
  isLocalMockMode;
