import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ deviceId: string; passTypeId: string }>
}

type RegistrationWithUser = {
  serial_number: string
  user_id: string | null
  users: { fecha_inicio_ciclo: string | null } | null
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { deviceId, passTypeId } = await params

  const url = new URL(request.url)
  const passesUpdatedSinceRaw = url.searchParams.get('passesUpdatedSince')
  const passesUpdatedSince = passesUpdatedSinceRaw
    ? new Date(passesUpdatedSinceRaw)
    : null

  const db = createServiceClient()
  const consulta = await db
    .from('wallet_registrations')
    .select('serial_number, user_id, users(fecha_inicio_ciclo)')
    .eq('device_library_id', deviceId)
    .eq('pass_type_id', passTypeId)
    .returns<RegistrationWithUser[]>()

  if (consulta.error) {
    console.error('[apple webservice GET serials]', consulta.error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const registros = consulta.data ?? []
  if (registros.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  const lastUpdatedTs = Math.max(
    ...registros.map(r => {
      const fecha = r.users?.fecha_inicio_ciclo
      if (!fecha) return 0
      const t = new Date(fecha).getTime()
      return Number.isFinite(t) ? t : 0
    }),
    0,
  )

  let serialNumbers: string[]
  if (passesUpdatedSince && !Number.isNaN(passesUpdatedSince.getTime())) {
    serialNumbers = lastUpdatedTs > passesUpdatedSince.getTime()
      ? registros.map(r => r.serial_number)
      : []
  } else {
    serialNumbers = registros.map(r => r.serial_number)
  }

  if (serialNumbers.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({
    lastUpdated: String(lastUpdatedTs || Date.now()),
    serialNumbers,
  })
}
