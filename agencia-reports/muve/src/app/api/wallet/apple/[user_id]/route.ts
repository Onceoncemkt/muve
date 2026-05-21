import { createHash, createHmac } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_LABELS, CREDITOS_POR_PLAN, normalizarPlan } from '@/lib/planes'
import { calcularVisitasRestantes } from '@/lib/creditos'
import { camposPaseWallet } from '@/lib/wallet/pase-campos'
import { CIUDAD_LABELS, type Ciudad } from '@/types'
import { generarPkpass } from '@/lib/wallet/apple-pkpass'
import { obtenerAssetsApplePass } from '@/lib/wallet/apple-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SocioRow = {
  id: string
  nombre: string | null
  plan: string | null
  plan_activo: boolean | string | number | null
  ciudad: Ciudad | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
  creditos_extra: number | null
  qr_code?: string | null
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

function generarAuthenticationToken(userId: string): string | null {
  const secret = process.env.WALLET_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(userId).digest('hex')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { user_id: userId } = await params
  if (user.id !== userId) {
    return NextResponse.json({ error: 'Sin permisos para este usuario' }, { status: 403 })
  }

  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID?.trim()
  const teamIdentifier = process.env.APPLE_TEAM_ID?.trim()
  const signerP12Base64 = process.env.APPLE_CERT_P12_BASE64?.trim()
  const signerP12Password = process.env.APPLE_CERT_PASSWORD ?? ''

  if (!passTypeIdentifier || !teamIdentifier || !signerP12Base64) {
    return NextResponse.json(
      { error: 'Apple Wallet no está configurado. Faltan APPLE_PASS_TYPE_ID / APPLE_TEAM_ID / APPLE_CERT_P12_BASE64.' },
      { status: 503 },
    )
  }

  const db = createServiceClient()
  const consultaConQr = await db
    .from('users')
    .select('id, nombre, plan, plan_activo, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code')
    .eq('id', userId)
    .maybeSingle<SocioRow>()

  let socio: SocioRow | null = null
  if (!consultaConQr.error) {
    socio = consultaConQr.data ?? null
  } else if (columnaNoExiste(consultaConQr.error, 'qr_code')) {
    const fallbackSinQr = await db
      .from('users')
      .select('id, nombre, plan, plan_activo, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra')
      .eq('id', userId)
      .maybeSingle<SocioRow>()
    if (fallbackSinQr.error) {
      console.error('[GET /api/wallet/apple/[user_id]] error cargando socio:', fallbackSinQr.error)
      return NextResponse.json({ error: 'No se pudo cargar el socio' }, { status: 500 })
    }
    socio = fallbackSinQr.data ?? null
  } else {
    console.error('[GET /api/wallet/apple/[user_id]] error cargando socio:', consultaConQr.error)
    return NextResponse.json({ error: 'No se pudo cargar el socio' }, { status: 500 })
  }

  if (!socio) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const planNormalizado = normalizarPlan(socio.plan) ?? 'basico'
  const plan = PLAN_LABELS[planNormalizado]
  const ciudad = ciudadSegura(socio.ciudad)
  const creditosExtra = Math.max(Math.trunc(socio.creditos_extra ?? 0), 0)
  const visitasIncluidasPlan = CREDITOS_POR_PLAN[planNormalizado] ?? 0

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
  const totalDisponibles = visitasIncluidasPlan + creditosExtra
  const creditos = creditosDisponibles || Math.max(totalDisponibles - visitasUsadas, 0)

  const qrValue = (socio.qr_code && socio.qr_code.trim().length > 0)
    ? socio.qr_code.trim()
    : createHash('sha256').update(userId).digest('hex')

  const campos = camposPaseWallet({
    planActivo: socio.plan_activo,
    plan: socio.plan,
    planLabelActivo: plan,
    creditosDisponibles: creditos,
    validoHastaActivo: formatearFecha(socio.fecha_fin_plan),
  })

  const nombre = (socio.nombre ?? user.email?.split('@')[0] ?? 'Socio MUVET').trim()
  const authenticationToken = generarAuthenticationToken(userId)
  const webServiceURL = authenticationToken
    ? (process.env.APPLE_WALLET_WEB_SERVICE_URL?.trim().replace(/\/$/, '')
       || 'https://www.muvet.mx/api/wallet/apple')
    : null

  let pkpass: Buffer
  try {
    const assets = await obtenerAssetsApplePass()
    pkpass = await generarPkpass(
      {
        organizationName: 'MUVET',
        description: 'Pase MUVET Wellness Club',
        passTypeIdentifier,
        teamIdentifier,
        serialNumber: `muvet-${userId}`,
        foregroundColor: 'rgb(232, 255, 71)',
        backgroundColor: 'rgb(107, 79, 232)',
        labelColor: 'rgb(255, 255, 255)',
        nombre,
        plan: campos.planLabel,
        ciudad: CIUDAD_LABELS[ciudad],
        creditosTexto: campos.creditosTexto,
        validoHasta: campos.validoHasta,
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
    console.error('[GET /api/wallet/apple/[user_id]] error generando .pkpass:', error)
    const message = error instanceof Error ? error.message : 'No se pudo generar Apple Wallet'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  await db
    .from('users')
    .update({ wallet_apple_agregado: true })
    .eq('id', userId)

  return new NextResponse(new Uint8Array(pkpass), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="muvet.pkpass"',
      'Cache-Control': 'no-store',
    },
  })
}
