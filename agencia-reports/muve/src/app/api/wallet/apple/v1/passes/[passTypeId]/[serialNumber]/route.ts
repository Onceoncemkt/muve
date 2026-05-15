import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_LABELS, CREDITOS_POR_PLAN, normalizarPlan } from '@/lib/planes'
import { calcularVisitasRestantes } from '@/lib/creditos'
import { CIUDAD_LABELS, type Ciudad } from '@/types'
import { generarPkpass } from '@/lib/wallet/apple-pkpass'
import { obtenerAssetsApplePass } from '@/lib/wallet/apple-assets'
import {
  generarAuthenticationToken,
  userIdDesdeSerial,
  verificarApplePassAuth,
} from '@/lib/wallet/apple-webservice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ passTypeId: string; serialNumber: string }>
}

type SocioRow = {
  id: string
  nombre: string | null
  plan: string | null
  ciudad: Ciudad | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
  creditos_extra: number | null
  qr_code?: string | null
  email?: string | null
}

function columnaNoExiste(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function formatearFecha(value: string | null | undefined) {
  if (!value) return 'Sin definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin definir'
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function ciudadSegura(ciudad: Ciudad | null | undefined): Ciudad {
  if (ciudad === 'pachuca' || ciudad === 'ensenada' || ciudad === 'tijuana' || ciudad === 'tecate') return ciudad
  return 'tulancingo'
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { passTypeId, serialNumber } = await params
  const auth = verificarApplePassAuth(request.headers.get('authorization'), serialNumber)
  if (!auth.ok) return new NextResponse(null, { status: 401 })

  const expectedPassType = process.env.APPLE_PASS_TYPE_ID?.trim()
  if (expectedPassType && passTypeId !== expectedPassType) {
    return new NextResponse(null, { status: 401 })
  }

  const userId = userIdDesdeSerial(serialNumber)
  const signerP12Base64 = process.env.APPLE_CERT_P12_BASE64?.trim()
  const signerP12Password = process.env.APPLE_CERT_PASSWORD ?? ''
  const teamIdentifier = process.env.APPLE_TEAM_ID?.trim() ?? ''
  if (!signerP12Base64 || !teamIdentifier) {
    return new NextResponse(null, { status: 500 })
  }

  const db = createServiceClient()
  const consulta = await db
    .from('users')
    .select('id, nombre, plan, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code, email')
    .eq('id', userId)
    .maybeSingle<SocioRow>()

  let socio: SocioRow | null = null
  if (!consulta.error) {
    socio = consulta.data ?? null
  } else if (columnaNoExiste(consulta.error, 'qr_code')) {
    const fallback = await db
      .from('users')
      .select('id, nombre, plan, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, email')
      .eq('id', userId)
      .maybeSingle<SocioRow>()
    socio = fallback.data ?? null
  }

  if (!socio) return new NextResponse(null, { status: 404 })

  const planNormalizado = normalizarPlan(socio.plan) ?? 'basico'
  const plan = PLAN_LABELS[planNormalizado]
  const ciudad = ciudadSegura(socio.ciudad)
  const creditosExtra = Math.max(Math.trunc(socio.creditos_extra ?? 0), 0)
  const visitasIncluidas = CREDITOS_POR_PLAN[planNormalizado] ?? 0

  let visitasUsadas = 0
  if (socio.fecha_inicio_ciclo && socio.fecha_fin_plan) {
    const { count } = await db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', socio.id)
      .gte('fecha', socio.fecha_inicio_ciclo)
      .lt('fecha', socio.fecha_fin_plan)
    visitasUsadas = count ?? 0
  }

  const creditosDisponibles = calcularVisitasRestantes({
    plan: planNormalizado,
    creditosExtra,
    visitasUsadasCiclo: visitasUsadas,
  })
  const totalDisponibles = visitasIncluidas + creditosExtra
  const creditos = creditosDisponibles || Math.max(totalDisponibles - visitasUsadas, 0)

  const qrValue = (socio.qr_code && socio.qr_code.trim().length > 0)
    ? socio.qr_code.trim()
    : createHash('sha256').update(userId).digest('hex')

  const nombre = (socio.nombre ?? socio.email?.split('@')[0] ?? 'Socio MUVET').trim()
  const authenticationToken = generarAuthenticationToken(userId)
  const webServiceURL = authenticationToken
    ? (process.env.APPLE_WALLET_WEB_SERVICE_URL?.trim().replace(/\/$/, '')
       || 'https://www.muvet.mx/api/wallet/apple')
    : null

  const ifModifiedSince = request.headers.get('if-modified-since')
  const lastUpdated = socio.fecha_inicio_ciclo
    ? new Date(socio.fecha_inicio_ciclo)
    : new Date()
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince)
    if (!Number.isNaN(since.getTime()) && lastUpdated.getTime() <= since.getTime()) {
      return new NextResponse(null, { status: 304 })
    }
  }

  let pkpass: Buffer
  try {
    const assets = await obtenerAssetsApplePass()
    pkpass = await generarPkpass(
      {
        organizationName: 'MUVET',
        description: 'Pase MUVET Wellness Club',
        passTypeIdentifier: passTypeId,
        teamIdentifier,
        serialNumber,
        foregroundColor: 'rgb(232, 255, 71)',
        backgroundColor: 'rgb(107, 79, 232)',
        labelColor: 'rgb(255, 255, 255)',
        nombre,
        plan,
        ciudad: CIUDAD_LABELS[ciudad],
        creditosTexto: `${creditos} disponibles`,
        validoHasta: formatearFecha(socio.fecha_fin_plan),
        qrValue,
        webServiceURL,
        authenticationToken,
        infoComoUsar: 'Muestra este pase al llegar a cualquier negocio afiliado MUVET. El staff escaneará tu QR para confirmar tu entrada.',
        contacto: 'hola@muvet.mx · muvet.mx',
      },
      assets,
      { signerP12Base64, signerP12Password },
    )
  } catch (error) {
    console.error('[apple webservice GET pass] error generando .pkpass:', error)
    return new NextResponse(null, { status: 500 })
  }

  return new NextResponse(new Uint8Array(pkpass), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': lastUpdated.toUTCString(),
      'Cache-Control': 'no-store',
    },
  })
}
