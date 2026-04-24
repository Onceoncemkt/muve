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

function normalizarRol(value: unknown): Rol | null {
  if (typeof value !== 'string') return null
  const rol = value.trim().toLowerCase()
  if (rol === 'usuario' || rol === 'staff' || rol === 'admin') return rol
  return null
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
  const body = await request.json().catch(() => ({} as { rol?: unknown }))
  const rol = normalizarRol(body.rol)

  if (!rol) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const payload: { rol: Rol; negocio_id?: string | null } = { rol }
  if (rol !== 'staff') {
    payload.negocio_id = null
  }

  const { data: usuarioObjetivo, error: objetivoError } = await db
    .from('users')
    .select('id')
    .eq('id', id)
    .maybeSingle<{ id: string }>()

  if (objetivoError || !usuarioObjetivo) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const { error: updateError } = await db
    .from('users')
    .update(payload)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rol })
}
