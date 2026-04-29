import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { EstadoReserva } from '@/types'
import { enviarPushAUsuarios, obtenerStaffIdsPorNegocio } from '@/lib/push/server'
import { normalizarPlan, puedeReservarConPlan } from '@/lib/planes'
import { planExpirado } from '@/lib/ciclos'

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
  if (!user) {
    return NextResponse.json(
      { error: 'Debes iniciar sesión y activar un plan para reservar.' },
      { status: 401 }
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const estado: EstadoReserva = body.estado

  if (!['cancelada', 'completada'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const db = admin()
  const { data: perfilActual, error: perfilActualError } = await db
    .from('users')
    .select('rol, plan_activo, plan, fecha_fin_plan')
    .eq('id', user.id)
    .maybeSingle<{
      rol: 'usuario' | 'staff' | 'admin'
      plan_activo: boolean
      plan: string | null
      fecha_fin_plan: string | null
    }>()

  if (perfilActualError || !perfilActual) {
    return NextResponse.json({ error: 'No se pudo validar tu membresía' }, { status: 500 })
  }

  if (perfilActual.rol === 'usuario') {
    if (!perfilActual.plan_activo || !normalizarPlan(perfilActual.plan ?? null)) {
      return NextResponse.json({ error: 'Necesitas un plan activo para reservar.' }, { status: 403 })
    }
    if (planExpirado(perfilActual.fecha_fin_plan)) {
      await db
        .from('users')
        .update({ plan_activo: false })
        .eq('id', user.id)
      return NextResponse.json({ error: 'Necesitas un plan activo para reservar.' }, { status: 403 })
    }
  }

  // Obtener reservación
  const { data: reserva, error: fetchError } = await db
    .from('reservaciones')
    .select('id, user_id, estado, fecha, horario_id')
    .eq('id', id)
    .single<{ id: string; user_id: string; estado: EstadoReserva; fecha: string; horario_id: string }>()

  if (fetchError || !reserva) {
    return NextResponse.json({ error: 'Reservación no encontrada' }, { status: 404 })
  }

  // Permisos
  const esPropia = reserva.user_id === user.id
  let negocioId: string | null = null
  let negocioNombre = 'negocio'

  if (estado === 'cancelada') {
    if (!esPropia) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { data: horario, error: horarioError } = await db
      .from('horarios')
      .select('hora_inicio, negocio_id')
      .eq('id', reserva.horario_id)
      .maybeSingle<{ hora_inicio: string; negocio_id: string | null }>()

    if (horarioError || !horario) {
      return NextResponse.json({ error: 'Horario no encontrado para esta reservación' }, { status: 400 })
    }

    negocioId = typeof horario.negocio_id === 'string' ? horario.negocio_id : null
    if (negocioId) {
      const { data: negocio } = await db
        .from('negocios')
        .select('nombre, nivel, plan_requerido')
        .eq('id', negocioId)
        .maybeSingle<{
          nombre: string
          nivel?: 'basico' | 'plus' | 'total' | null
          plan_requerido?: 'basico' | 'plus' | 'total' | null
        }>()
      negocioNombre = negocio?.nombre ?? 'negocio'

      const planUsuario = normalizarPlan(perfilActual.plan ?? null) ?? 'basico'
      const nivelNegocio = negocio?.nivel === 'plus' || negocio?.nivel === 'total'
        ? negocio.nivel
        : negocio?.plan_requerido === 'plus' || negocio?.plan_requerido === 'total'
          ? negocio.plan_requerido
        : 'basico'
      if (!puedeReservarConPlan(planUsuario, nivelNegocio)) {
        return NextResponse.json(
          { error: nivelNegocio === 'plus' ? 'Este lugar requiere plan Plus' : 'Este lugar requiere plan Total' },
          { status: 403 }
        )
      }
    }

    // Solo se puede cancelar con más de 2h de anticipación
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
    if (!['staff', 'admin'].includes(perfilActual.rol)) {
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

  if (estado === 'cancelada') {
    const { data: usuario } = await db
      .from('users')
      .select('nombre')
      .eq('id', reserva.user_id)
      .maybeSingle<{ nombre: string }>()

    const usuarioNombre = usuario?.nombre ?? user.email?.split('@')[0] ?? 'Usuario'

    await enviarPushAUsuarios(
      [reserva.user_id],
      {
        title: 'MUVET',
        body: `Reservación cancelada en ${negocioNombre}`,
        url: '/historial',
      }
    )

    if (negocioId) {
      const staffIds = await obtenerStaffIdsPorNegocio(negocioId)
      if (staffIds.length > 0) {
        await enviarPushAUsuarios(
          staffIds,
          {
            title: 'MUVET',
            body: `${usuarioNombre} canceló su reservación del ${reserva.fecha}`,
            url: '/negocio/dashboard',
          }
        )
      }
    }
  }

  return NextResponse.json({ success: true })
}
