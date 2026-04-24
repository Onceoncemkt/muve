import 'server-only'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { normalizarRol, rolDesdeAuth } from '@/lib/auth/roles'
import type { Rol } from '@/types'

function admin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function obtenerRolServidor(user: SupabaseUser | null | undefined): Promise<Rol> {
  if (!user) return 'usuario'

  const db = admin()
  if (!db) return rolDesdeAuth(user) ?? 'usuario'

  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle<{ rol: Rol }>()

  return normalizarRol(perfil?.rol) ?? rolDesdeAuth(user) ?? 'usuario'
}
