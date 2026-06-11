import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enviarPushAUsuarios } from '@/lib/push/server'

const MAX_NO_SHOWS = 3
const SUSPENSION_DAYS = 7
const MINUTOS_TOLERANCIA_NO_SHOW = 30

type ReservaNoShow = {
  id: string
  user_id: string
  fecha: string
  horarios: {
    hora_inicio: string
    hora_fin: string
    negocio_id: string
    negocios: { nombre: string } | { nombre: string }[] | null
  } | {
    hora_inicio: string
    hora_fin: string
    negocio_id: string
    negocios: { nombre: string } | { nombre: string }[] | null
  }[] | null
}

type ReservaActualizada = {
  id: string
  user_id: string
}

function obtenerRelacion<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

function limiteNoShowReserva(reserva: ReservaNoShow) {
  const horario = obtenerRelacion(reserva.horarios)
  if (!horario?.hora_inicio) return null
  const inicioClase = new Date(`${reserva.fecha}T${horario.hora_inicio}`)
  if (Number.isNaN(inicioClase.getTime())) return null
  return new Date(inicioClase.getTime() + MINUTOS_TOLERANCIA_NO_SHOW * 60 * 1000)
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = createServiceClient()
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ahora = new Date()
    const hoyISO = ahora.toISOString().split('T')[0]
    const cicloInicio = new Date(ahora)
    cicloInicio.setDate(cicloInicio.getDate() - 30)
    const cicloInicioISO = cicloInicio.toISOString().split('T')[0]

    const { data: reservacionesConfirmadas, error: errorReservaciones } = await supabaseAdmin
      .from('reservaciones')
      .select(`
        id,
        user_id,
        fecha,
        horarios!inner (
          hora_inicio,
          hora_fin,
          negocio_id,
          negocios!inner (
            nombre
          )
        )
      `)
      .eq('estado', 'confirmada')
      .lte('fecha', hoyISO)

    if (errorReservaciones) {
      throw errorReservaciones
    }

    const reservacionesPasadas = ((reservacionesConfirmadas ?? []) as ReservaNoShow[]).filter(reserva => {
      if (reserva.fecha < hoyISO) return true
      if (reserva.fecha > hoyISO) return false
      const limite = limiteNoShowReserva(reserva)
      return Boolean(limite && ahora > limite)
    })

    if (reservacionesPasadas.length === 0) {
      return NextResponse.json({
        success: true,
        message: '0 reservaciones marcadas como no-show',
        suspendidos: 0
      })
    }

    const idsReservacionesPasadas = reservacionesPasadas.map((reserva) => reserva.id)
    const reservacionesMap = new Map(reservacionesPasadas.map((reserva) => [reserva.id, reserva]))

    const { data: reservacionesActualizadasData, error: errorUpdate } = await supabaseAdmin
      .from('reservaciones')
      .update({ estado: 'no_show' })
      .in('id', idsReservacionesPasadas)
      .eq('estado', 'confirmada')
      .select('id, user_id')
      .returns<ReservaActualizada[]>()

    if (errorUpdate) {
      throw errorUpdate
    }

    const reservacionesActualizadas = reservacionesActualizadasData ?? []
    let suspendidos = 0

    for (const reservacion of reservacionesActualizadas) {
      const reservacionOriginal = reservacionesMap.get(reservacion.id)
      const horario = obtenerRelacion(reservacionOriginal?.horarios)
      const negocio = obtenerRelacion(horario?.negocios)
      const nombreNegocio = negocio?.nombre ?? 'el negocio'

      const { count: totalNoShowsCiclo, error: errorNoShowsCiclo } = await supabaseAdmin
        .from('reservaciones')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', reservacion.user_id)
        .eq('estado', 'no_show')
        .gte('fecha', cicloInicioISO)
        .lte('fecha', hoyISO)

      if (errorNoShowsCiclo) {
        console.error('Error contando no_shows del ciclo', reservacion.id, errorNoShowsCiclo)
      }

      const totalNoShows = totalNoShowsCiclo ?? 0

      await enviarPushAUsuarios([reservacion.user_id], {
        title: 'No-show registrado',
        body: `No hiciste check-in en ${nombreNegocio}. Acumulas ${totalNoShows} no-show(s) en tu ciclo actual.`,
        url: '/historial'
      })

      if (totalNoShows >= MAX_NO_SHOWS) {
        const fechaFinSuspension = new Date()
        fechaFinSuspension.setDate(fechaFinSuspension.getDate() + SUSPENSION_DAYS)

        const { error: errorSuspension } = await supabaseAdmin
          .from('users')
          .update({
            reservas_suspendidas_hasta: fechaFinSuspension.toISOString()
          })
          .eq('id', reservacion.user_id)

        if (errorSuspension) {
          console.error('Error suspendiendo usuario', reservacion.user_id, errorSuspension)
        } else {
          suspendidos++
          await enviarPushAUsuarios([reservacion.user_id], {
            title: 'Cuenta suspendida temporalmente',
            body: `Tu cuenta fue suspendida por ${SUSPENSION_DAYS} días al acumular ${MAX_NO_SHOWS} no-shows.`,
            url: '/dashboard'
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${reservacionesActualizadas.length} reservaciones marcadas como no-show`,
      suspendidos
    })
  } catch (error) {
    console.error('Error en cron marcar-noshow:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
