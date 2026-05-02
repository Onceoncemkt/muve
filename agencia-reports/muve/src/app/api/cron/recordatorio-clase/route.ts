import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enviarPushAUsuarios } from '@/lib/push/server'
import { formatHora } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReservacionRecordatorio = {
  id: string
  user_id: string
  fecha: string
  horarios: {
    hora_inicio: string
    negocios: {
      nombre: string
    } | null
  } | null
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

function fechaYmd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function fechaHoraReserva(fecha: string, hora: string) {
  const parsed = new Date(`${fecha}T${hora}`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const ahora = new Date()
  const dosHoras = new Date(ahora.getTime() + 2 * 60 * 60 * 1000)
  const tresHoras = new Date(ahora.getTime() + 3 * 60 * 60 * 1000)

  const fechas = [...new Set([fechaYmd(dosHoras), fechaYmd(tresHoras)])]

  const db = createServiceClient()
  const { data: reservaciones, error } = await db
    .from('reservaciones')
    .select('id, user_id, fecha, horarios(hora_inicio, negocios(nombre))')
    .eq('estado', 'confirmada')
    .in('fecha', fechas)
    .returns<ReservacionRecordatorio[]>()

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'No se pudieron cargar reservaciones para recordatorio' },
      { status: 500 }
    )
  }

  let pushEnviados = 0
  let candidatos = 0

  for (const reservacion of reservaciones ?? []) {
    const hora = reservacion.horarios?.hora_inicio
    const negocio = reservacion.horarios?.negocios?.nombre
    if (!hora || !negocio) continue

    const fechaHora = fechaHoraReserva(reservacion.fecha, hora)
    if (!fechaHora) continue

    const timestamp = fechaHora.getTime()
    if (timestamp < dosHoras.getTime() || timestamp >= tresHoras.getTime()) continue
    candidatos += 1

    const pushResult = await enviarPushAUsuarios([reservacion.user_id], {
      title: 'MUVET',
      body: `Tu clase en ${negocio} es a las ${formatHora(hora)} (en 2 horas). Si no puedes ir cancela con tiempo.`,
      url: '/dashboard',
    })
    if (pushResult.sent > 0) pushEnviados += 1
  }

  return NextResponse.json({
    ok: true,
    candidatos,
    push_notificados: pushEnviados,
  })
}
