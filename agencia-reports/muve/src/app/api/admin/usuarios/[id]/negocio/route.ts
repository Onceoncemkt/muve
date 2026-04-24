import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Rol } from '@/types'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function normalizarNegocioId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({} as { negocio_id?: unknown }))
  const negocioId = normalizarNegocioId(body.negocio_id)

  const { data: usuarioObjetivo, error: usuarioObjetivoError } = await db
    .from('users')
    .select('rol')
    .eq('id', id)
    .single<{ rol: Rol }>()

  if (usuarioObjetivoError || !usuarioObjetivo) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (usuarioObjetivo.rol !== 'staff') {
    return NextResponse.json(
      { error: 'Solo se puede asignar negocio a usuarios staff' },
      { status: 400 }
    )
  }

  if (negocioId) {
    const { data: negocio, error: negocioError } = await db
      .from('negocios')
      .select('id')
      .eq('id', negocioId)
      .maybeSingle<{ id: string }>()

    if (negocioError || !negocio) {
      return NextResponse.json(
        { error: 'El negocio seleccionado no existe' },
        { status: 400 }
      )
    }
  }

  const { error: updateError } = await db
    .from('users')
    .update({ negocio_id: negocioId })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, negocio_id: negocioId })
}
