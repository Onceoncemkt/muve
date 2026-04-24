import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { EstadoReserva } from '@/types'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/reservaciones/[id] — cancelar (usuario) o completar (staff)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const estado: EstadoReserva = body.estado

  if (!['cancelada', 'completada'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const db = admin()

  // Obtener reservación con su horario
  const { data: reserva, error: fetchError } = await db
    .from('reservaciones')
    .select('id, user_id, estado, fecha, horarios(hora_inicio)')
    .eq('id', id)
    .single()

  if (fetchError || !reserva) {
    return NextResponse.json({ error: 'Reservación no encontrada' }, { status: 404 })
  }

  // Permisos
  const esPropia = reserva.user_id === user.id

  if (estado === 'cancelada') {
    if (!esPropia) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Solo se puede cancelar con más de 2h de anticipación
    const horarioRelacion = reserva.horarios as { hora_inicio: string } | { hora_inicio: string }[] | null
    const horario = Array.isArray(horarioRelacion) ? horarioRelacion[0] : horarioRelacion
    if (!horario?.hora_inicio) {
      return NextResponse.json({ error: 'Horario no encontrado para esta reservación' }, { status: 400 })
    }
    const fechaHora = new Date(`${reserva.fecha}T${horario.hora_inicio}`)
    const diffMs = fechaHora.getTime() - Date.now()
    if (diffMs < 2 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Solo se puede cancelar con más de 2 horas de anticipación' },
        { status: 400 }
      )
    }
  }

  if (estado === 'completada') {
    // Solo staff/admin puede marcar completada
    const { data: perfil } = await db
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single()
    if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const { error: updateError } = await db
    .from('reservaciones')
    .update({ estado })
    .eq('id', id)

  if (updateError) {
    console.error('[PATCH /api/reservaciones/id]', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
