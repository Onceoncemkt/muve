import { createClient as createAdminClient } from '@supabase/supabase-js'

function serviceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (key.startsWith('tsb_secret_')) {
    return key.replace(/^tsb_secret_/, 'sb_secret_')
  }
  return key
}

export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
