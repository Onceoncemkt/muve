import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { formatHora, type DiaSemana, type EstadoReserva, type Rol } from '@/types'
import { enviarPushAUsuarios } from '@/lib/push/server'

type EstadoEditable = Extract<EstadoReserva, 'cancelada' | 'completada' | 'no_show'>

type Body = {
  estado?: unknown
  fecha?: unknown
  horario_id?: unknown
  negocio_id?: unknown
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function diaSemanaDesdeFecha(fecha: string): DiaSemana | null {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return dias[date.getDay()]
}

function estadoValido(estado: unknown): estado is EstadoEditable {
  return estado === 'cancelada' || estado === 'completada' || estado === 'no_show'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

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
  const body = await request.json().catch(() => ({} as Body))

  const estado = body.estado
  const fecha = typeof body.fecha === 'string' ? body.fecha.trim() : ''
  const horarioId = typeof body.horario_id === 'string' ? body.horario_id.trim() : ''
  const negocioId = typeof body.negocio_id === 'string' ? body.negocio_id.trim() : ''

  const { data: reservacionActual, error: reservacionError } = await db
    .from('reservaciones')
    .select('id, user_id, fecha, estado, horario_id')
    .eq('id', id)
    .maybeSingle<{ id: string; user_id: string; fecha: string; estado: EstadoReserva | string; horario_id: string }>()

  if (reservacionError || !reservacionActual) {
    return NextResponse.json({ error: 'Reservación no encontrada' }, { status: 404 })
  }

  const esReprogramacion = Boolean(fecha && horarioId)

  if (!esReprogramacion && !estadoValido(estado)) {
    return NextResponse.json({ error: 'Debes enviar estado válido o fecha+horario_id' }, { status: 400 })
  }

  if (esReprogramacion) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Fecha inválida (YYYY-MM-DD)' }, { status: 400 })
    }

    const diaSemana = diaSemanaDesdeFecha(fecha)
    if (!diaSemana) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    const { data: horario, error: horarioError } = await db
      .from('horarios')
      .select('id, negocio_id, dia_semana, hora_inicio, capacidad_total, activo')
      .eq('id', horarioId)
      .maybeSingle<{
        id: string
        negocio_id: string
        dia_semana: DiaSemana
        hora_inicio: string
        capacidad_total: number
        activo: boolean
      }>()

    if (horarioError || !horario || !horario.activo) {
      return NextResponse.json({ error: 'Horario no disponible' }, { status: 400 })
    }
    if (horario.dia_semana !== diaSemana) {
      return NextResponse.json({ error: 'El horario no corresponde al día de la fecha seleccionada' }, { status: 400 })
    }
    if (negocioId && negocioId !== horario.negocio_id) {
      return NextResponse.json({ error: 'El horario seleccionado no corresponde al negocio' }, { status: 400 })
    }

    const { count: ocupados } = await db
      .from('reservaciones')
      .select('id', { count: 'exact', head: true })
      .eq('horario_id', horarioId)
      .eq('fecha', fecha)
      .eq('estado', 'confirmada')

    const ocupadosSinActual = reservacionActual.horario_id === horarioId && reservacionActual.fecha === fecha
      ? Math.max((ocupados ?? 0) - 1, 0)
      : (ocupados ?? 0)

    if (ocupadosSinActual >= horario.capacidad_total) {
      return NextResponse.json({ error: 'No hay disponibilidad para el nuevo horario/fecha' }, { status: 409 })
    }

    const { error: updateError } = await db
      .from('reservaciones')
      .update({
        fecha,
        horario_id: horarioId,
        estado: 'confirmada',
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message ?? 'No se pudo reprogramar la reservación' }, { status: 500 })
    }

    await enviarPushAUsuarios(
      [reservacionActual.user_id],
      {
        title: 'MUVET',
        body: `Tu reservación fue modificada por el equipo MUVET. Nueva fecha: ${fecha} a las ${formatHora(horario.hora_inicio)}`,
        url: '/dashboard',
      }
    )

    return NextResponse.json({ ok: true, accion: 'reprogramada' })
  }

  const estadoFinal = estado as EstadoEditable
  const { error: updateEstadoError } = await db
    .from('reservaciones')
    .update({ estado: estadoFinal })
    .eq('id', id)

  if (updateEstadoError) {
    return NextResponse.json({ error: updateEstadoError.message ?? 'No se pudo actualizar estado' }, { status: 500 })
  }

  if (estadoFinal === 'cancelada') {
    const { data: perfilObjetivo } = await db
      .from('users')
      .select('creditos_extra')
      .eq('id', reservacionActual.user_id)
      .maybeSingle<{ creditos_extra: number | null }>()

    const creditosActuales = Math.max(Math.trunc(perfilObjetivo?.creditos_extra ?? 0), 0)
    await db
      .from('users')
      .update({ creditos_extra: creditosActuales + 1 })
      .eq('id', reservacionActual.user_id)
  }

  return NextResponse.json({ ok: true, accion: 'estado_actualizado', estado: estadoFinal })
}
