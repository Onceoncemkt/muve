import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolverVentanaCiclo } from '@/lib/ciclos'
import { normalizarPlan } from '@/lib/planes'
import { enviarPushAUsuarios } from '@/lib/push/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReservacionPendiente = {
  id: string
  user_id: string
  fecha: string
  horario_id: string
  horarios: {
    hora_inicio: string
    negocio_id: string
  } | null
}

type VisitaRow = {
  id: string
  user_id: string
  negocio_id: string
  fecha: string
  estado: string | null
}

type UsuarioCiclo = {
  id: string
  plan: string | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
  reservas_suspendidas_hasta: string | null
}

function esRequestAutorizado(request: NextRequest) {
  const esCronVercel = request.headers.get('x-vercel-cron') === '1'
  if (esCronVercel) return true

  const secretoCron = process.env.CRON_SECRET?.trim()
  if (!secretoCron) {
    return process.env.NODE_ENV === 'development'
  }

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${secretoCron}`
}

function toDateTime(fecha: string, hora: string) {
  const parsed = new Date(`${fecha}T${hora}`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function fechaYmd(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = createServiceClient()
  const ahora = new Date()
  const hoy = fechaYmd(ahora)

  const { data: reservaciones, error: reservacionesError } = await db
    .from('reservaciones')
    .select('id, user_id, fecha, horario_id, horarios(hora_inicio, negocio_id)')
    .eq('estado', 'confirmada')
    .lte('fecha', hoy)
    .returns<ReservacionPendiente[]>()

  if (reservacionesError) {
    return NextResponse.json(
      { error: reservacionesError.message ?? 'No se pudieron cargar reservaciones pendientes' },
      { status: 500 }
    )
  }

  const candidatas = (reservaciones ?? []).filter((reservacion) => {
    const hora = reservacion.horarios?.hora_inicio
    if (!hora) return false
    const fechaHora = toDateTime(reservacion.fecha, hora)
    if (!fechaHora) return false
    return fechaHora.getTime() < ahora.getTime()
  })

  if (candidatas.length === 0) {
    return NextResponse.json({
      ok: true,
      reservaciones_no_show: 0,
      visitas_no_show: 0,
      usuarios_suspendidos: 0,
    })
  }

  const idsNoShow = candidatas.map((r) => r.id)
  const { error: noShowError } = await db
    .from('reservaciones')
    .update({ estado: 'no_show' })
    .in('id', idsNoShow)

  if (noShowError) {
    return NextResponse.json(
      { error: noShowError.message ?? 'No se pudieron marcar reservaciones no_show' },
      { status: 500 }
    )
  }

  const usuarioIds = [...new Set(candidatas.map((r) => r.user_id))]
  const negocioIds = [...new Set(candidatas.map((r) => r.horarios?.negocio_id).filter(Boolean) as string[])]
  const fechaMin = candidatas.reduce((min, r) => (r.fecha < min ? r.fecha : min), candidatas[0].fecha)
  const fechaMax = candidatas.reduce((max, r) => (r.fecha > max ? r.fecha : max), candidatas[0].fecha)

  const inicioRango = `${fechaMin}T00:00:00.000Z`
  const finRango = `${fechaMax}T23:59:59.999Z`

  const { data: visitasExistentes } = await db
    .from('visitas')
    .select('id, user_id, negocio_id, fecha, estado')
    .in('user_id', usuarioIds)
    .in('negocio_id', negocioIds)
    .gte('fecha', inicioRango)
    .lte('fecha', finRango)
    .returns<VisitaRow[]>()

  const visitasPorLlave = new Map<string, VisitaRow>()
  for (const visita of visitasExistentes ?? []) {
    const llave = `${visita.user_id}|${visita.negocio_id}|${fechaYmd(new Date(visita.fecha))}`
    if (!visitasPorLlave.has(llave)) {
      visitasPorLlave.set(llave, visita)
    }
  }

  const { data: usuarios } = await db
    .from('users')
    .select('id, plan, fecha_inicio_ciclo, fecha_fin_plan, reservas_suspendidas_hasta')
    .in('id', usuarioIds)
    .returns<UsuarioCiclo[]>()

  const usuarioPorId = new Map((usuarios ?? []).map((u) => [u.id, u]))

  const nuevasVisitas: Array<{
    user_id: string
    negocio_id: string
    fecha: string
    validado_por: string
    plan_usuario: string | null
    estado: 'no_show'
  }> = []

  for (const reservacion of candidatas) {
    const negocioId = reservacion.horarios?.negocio_id
    const hora = reservacion.horarios?.hora_inicio
    if (!negocioId || !hora) continue

    const fechaHora = toDateTime(reservacion.fecha, hora)
    if (!fechaHora) continue
    const llave = `${reservacion.user_id}|${negocioId}|${reservacion.fecha}`
    const visitaExistente = visitasPorLlave.get(llave)
    if (visitaExistente && visitaExistente.estado !== 'cancelado') continue

    const perfil = usuarioPorId.get(reservacion.user_id)
    nuevasVisitas.push({
      user_id: reservacion.user_id,
      negocio_id: negocioId,
      fecha: fechaHora.toISOString(),
      validado_por: 'Sistema no-show',
      plan_usuario: normalizarPlan(perfil?.plan ?? null),
      estado: 'no_show',
    })
  }

  if (nuevasVisitas.length > 0) {
    const { error: insertVisitasError } = await db
      .from('visitas')
      .insert(nuevasVisitas)
    if (insertVisitasError) {
      return NextResponse.json(
        { error: insertVisitasError.message ?? 'No se pudieron registrar visitas no_show' },
        { status: 500 }
      )
    }
  }

  let usuariosSuspendidos = 0
  for (const userId of usuarioIds) {
    const perfil = usuarioPorId.get(userId)
    if (!perfil) continue

    const ciclo = resolverVentanaCiclo({
      fechaInicioCiclo: perfil.fecha_inicio_ciclo,
      fechaFinPlan: perfil.fecha_fin_plan,
      referencia: ahora,
    })

    const { count } = await db
      .from('reservaciones')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('estado', 'no_show')
      .gte('fecha', fechaYmd(ciclo.inicio))
      .lte('fecha', fechaYmd(ciclo.fin))

    const noShowsCiclo = count ?? 0
    const suspensionActual = perfil.reservas_suspendidas_hasta
      ? new Date(perfil.reservas_suspendidas_hasta)
      : null
    const suspensionVigente = suspensionActual && !Number.isNaN(suspensionActual.getTime())
      ? suspensionActual.getTime() > ahora.getTime()
      : false

    if (noShowsCiclo >= 3 && !suspensionVigente) {
      const reservasSuspendidasHasta = new Date(ahora)
      reservasSuspendidasHasta.setDate(reservasSuspendidasHasta.getDate() + 7)
      const { error: suspensionError } = await db
        .from('users')
        .update({ reservas_suspendidas_hasta: reservasSuspendidasHasta.toISOString() })
        .eq('id', userId)

      if (!suspensionError) {
        usuariosSuspendidos += 1
        await enviarPushAUsuarios([userId], {
          title: 'MUVET',
          body: 'Has acumulado 3 no-shows. Tu acceso a reservas está suspendido por 7 días.',
          url: '/dashboard',
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    reservaciones_no_show: idsNoShow.length,
    visitas_no_show: nuevasVisitas.length,
    usuarios_suspendidos: usuariosSuspendidos,
  })
}
