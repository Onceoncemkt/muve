import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizarRol, rolDesdeAuth } from '@/lib/auth/roles'
import type { Rol } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: perfil } = await supabase
    .schema('public')
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle<{ rol: Rol }>()

  const rol = normalizarRol(perfil?.rol) ?? rolDesdeAuth(user) ?? 'usuario'
  return NextResponse.json({ rol })
}
