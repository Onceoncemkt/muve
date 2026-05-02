import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enviarPushAUsuarios } from '@/lib/push/server'

const MAX_NO_SHOWS = 3
const SUSPENSION_DAYS = 7

type ReservaNoShow = {
  id: string
  user_id: string
  negocio_id: string
  fecha: string
  horario_id: string
  horarios: {
    hora_inicio: string
    hora_fin: string
  }[] | null
  negocios: {
    nombre: string
  }[] | null
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
    const horaActual = ahora.toTimeString().slice(0, 5)

    const { data: reservaciones, error: errorReservaciones } = await supabaseAdmin
      .from('reservaciones')
      .select(`
        id,
        user_id,
        negocio_id,
        fecha,
        horario_id,
        horarios!inner (
          hora_inicio,
          hora_fin
        ),
        negocios!inner (
          nombre
        )
      `)
      .eq('estado', 'confirmada')
      .or(`fecha.lt.${hoyISO},and(fecha.eq.${hoyISO},horarios.hora_inicio.lte.${horaActual})`)

    if (errorReservaciones) {
      throw errorReservaciones
    }

    const reservacionesPasadas = ((reservaciones ?? []) as ReservaNoShow[]).filter(reserva => {
      const horario = Array.isArray(reserva.horarios) ? reserva.horarios[0] : null
      if (!horario?.hora_inicio) return false
      const inicio = new Date(`${reserva.fecha}T${horario.hora_inicio}:00`)
      return inicio <= ahora
    })

    let procesadas = 0
    let suspendidos = 0

    const cicloInicio = new Date(ahora)
    cicloInicio.setDate(cicloInicio.getDate() - 30)
    const cicloInicioISO = cicloInicio.toISOString().split('T')[0]

    for (const reservacion of reservacionesPasadas) {
      const { data: visitaCheckin, error: errorVisitaCheckin } = await supabaseAdmin
        .from('visitas')
        .select('id')
        .eq('user_id', reservacion.user_id)
        .eq('negocio_id', reservacion.negocio_id)
        .eq('fecha_visita', reservacion.fecha)
        .eq('tipo_visita', 'checkin')
        .limit(1)

      if (errorVisitaCheckin) {
        console.error('Error verificando checkin', reservacion.id, errorVisitaCheckin)
        continue
      }

      if ((visitaCheckin ?? []).length > 0) {
        continue
      }

      const { data: reservaActualizada, error: errorUpdate } = await supabaseAdmin
        .from('reservaciones')
        .update({
          estado: 'no_show',
          updated_at: new Date().toISOString()
        })
        .eq('id', reservacion.id)
        .eq('estado', 'confirmada')
        .select('id')
        .single()

      if (errorUpdate || !reservaActualizada) {
        if (errorUpdate) {
          console.error('Error marcando no_show', reservacion.id, errorUpdate)
        }
        continue
      }

      procesadas++

      const { data: visitaNoShow, error: errorVisitaNoShow } = await supabaseAdmin
        .from('visitas')
        .select('id')
        .eq('reservacion_id', reservacion.id)
        .eq('tipo_visita', 'no_show')
        .limit(1)

      if (errorVisitaNoShow) {
        console.error('Error verificando no_show en visitas', reservacion.id, errorVisitaNoShow)
        continue
      }

      if ((visitaNoShow ?? []).length === 0) {
        const { error: errorInsertVisita } = await supabaseAdmin
          .from('visitas')
          .insert({
            user_id: reservacion.user_id,
            negocio_id: reservacion.negocio_id,
            reservacion_id: reservacion.id,
            fecha_visita: reservacion.fecha,
            tipo_visita: 'no_show',
            creditos_descontados: 1
          })

        if (errorInsertVisita) {
          console.error('Error insertando visita no_show', reservacion.id, errorInsertVisita)
        }
      }

      const { data: noShowsCiclo, error: errorNoShowsCiclo } = await supabaseAdmin
        .from('reservaciones')
        .select('id')
        .eq('user_id', reservacion.user_id)
        .eq('estado', 'no_show')
        .gte('fecha', cicloInicioISO)
        .lte('fecha', hoyISO)

      if (errorNoShowsCiclo) {
        console.error('Error contando no_shows del ciclo', reservacion.id, errorNoShowsCiclo)
      }

      const totalNoShowsCiclo = noShowsCiclo?.length ?? 0
      const negocio = Array.isArray(reservacion.negocios) ? reservacion.negocios[0] : null
      const nombreNegocio = negocio?.nombre ?? 'el negocio'

      await enviarPushAUsuarios([reservacion.user_id], {
        title: 'No-show registrado',
        body: `No hiciste check-in en ${nombreNegocio}. Acumulas ${totalNoShowsCiclo} no-show(s) en tu ciclo actual.`,
        url: '/historial'
      })

      if (totalNoShowsCiclo >= MAX_NO_SHOWS) {
        const fechaFinSuspension = new Date()
        fechaFinSuspension.setDate(fechaFinSuspension.getDate() + SUSPENSION_DAYS)

        const { error: errorSuspension } = await supabaseAdmin
          .from('users')
          .update({
            reservas_suspendidas_hasta: fechaFinSuspension.toISOString(),
            updated_at: new Date().toISOString()
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
      message: `${procesadas} reservaciones marcadas como no-show`,
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
