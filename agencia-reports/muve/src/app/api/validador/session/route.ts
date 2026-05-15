import { NextResponse } from 'next/server'
import { getValidadorSession } from '@/lib/validador-auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()

  const session = await getValidadorSession()
  if (session) {
    const { data: negocio } = await supabase
      .from('negocios')
      .select('nombre')
      .eq('id', session.negocio_id)
      .single<{ nombre: string }>()
    return NextResponse.json({
      ...session,
      tipo: 'validador' as const,
      negocio_nombre: negocio?.nombre ?? null,
    })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const db = createServiceClient()
  const { data: perfil, error: perfilError } = await db
    .from('users')
    .select('rol, nombre, negocio_id')
    .eq('id', user.id)
    .single<{ rol: string; nombre: string | null; negocio_id: string | null }>()

  if (perfilError || !perfil || (perfil.rol !== 'staff' && perfil.rol !== 'admin')) {
    return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  }
  if (!perfil.negocio_id) {
    return NextResponse.json({ error: 'Tu cuenta no tiene negocio asignado' }, { status: 401 })
  }

  const { data: negocio } = await db
    .from('negocios')
    .select('nombre')
    .eq('id', perfil.negocio_id)
    .single<{ nombre: string }>()

  return NextResponse.json({
    tipo: 'staff' as const,
    validador_id: user.id,
    negocio_id: perfil.negocio_id,
    nombre: perfil.nombre ?? user.email?.split('@')[0] ?? 'Staff',
    negocio_nombre: negocio?.nombre ?? null,
  })
}
