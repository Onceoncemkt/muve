import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROLE_COOKIE_MAX_AGE, ROLE_COOKIE_NAME, normalizarRol, panelPorRol, rolDesdeAuth } from '@/lib/auth/roles'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    cookieStore.set(ROLE_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: perfil } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: string }>()

  const rol = normalizarRol(perfil?.rol) ?? rolDesdeAuth(user) ?? 'usuario'
  cookieStore.set(ROLE_COOKIE_NAME, rol, {
    path: '/',
    maxAge: ROLE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json({ rol, destino: panelPorRol(rol) })
}
