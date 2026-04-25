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

function normalizarTextoOpcional(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

// PATCH /api/negocio/horarios/[id] — editar (activo, capacidad, coach, tipo de clase) — solo staff/admin
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
  if (typeof body.capacidad_total === 'number' && Number.isFinite(body.capacidad_total)) {
    const capacidad = Math.trunc(body.capacidad_total)
    if (capacidad < 1) {
      return NextResponse.json({ error: 'capacidad_total debe ser mayor a 0' }, { status: 400 })
    }
    updates.capacidad_total = capacidad
  } else if (typeof body.capacidad_total === 'string' && body.capacidad_total.trim().length > 0) {
    const parsed = Number.parseInt(body.capacidad_total, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json({ error: 'capacidad_total debe ser mayor a 0' }, { status: 400 })
    }
    updates.capacidad_total = parsed
  }
  if ('nombre_coach' in body) updates.nombre_coach = normalizarTextoOpcional(body.nombre_coach)
  if ('tipo_clase' in body) updates.tipo_clase = normalizarTextoOpcional(body.tipo_clase)

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
