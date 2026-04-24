import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/negocio/horarios/[id] — editar (activo, capacidad) — solo staff/admin
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()

  const { data: perfil } = await db
    .from('users').select('rol').eq('id', user.id).single()
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  // Solo se pueden actualizar estos campos
  const updates: Record<string, unknown> = {}
  if (typeof body.activo === 'boolean') updates.activo = body.activo
  if (typeof body.capacidad_total === 'number') updates.capacidad_total = body.capacidad_total

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await db
    .from('horarios')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[PATCH /api/negocio/horarios/id]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ horario: data })
}

// DELETE /api/negocio/horarios/[id] — solo admin
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()

  const { data: perfil } = await db
    .from('users').select('rol').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede eliminar horarios' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await db.from('horarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
