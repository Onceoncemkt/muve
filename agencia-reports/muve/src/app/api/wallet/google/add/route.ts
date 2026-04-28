import { createSign } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_LABELS, PLAN_VISITAS_MENSUALES, normalizarPlan } from '@/lib/planes'
import { CIUDAD_LABELS, type Ciudad } from '@/types'

export const runtime = 'nodejs'

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID ?? ''
const CLASS_ID = process.env.GOOGLE_WALLET_CLASS_ID ?? '3388000000023124514.muvetmembershipv1'
const SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_WALLET_CLIENT_EMAIL ?? ''
const PRIVATE_KEY = (process.env.GOOGLE_WALLET_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

type AddWalletBody = { user_id?: string; userId?: string }

type SocioRow = {
  id: string
  nombre: string | null
  plan: string | null
  ciudad: Ciudad | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
  creditos_extra: number | null
  qr_code?: string | null
}

type LoyaltyObjectPayload = {
  objectId: string
  classId: string
  userId: string
  nombre: string
  plan: 'BÁSICO' | 'PLUS' | 'TOTAL'
  ciudad: string
  visitasUsadas: number
  visitasTotales: number
  fechaVencimiento: string
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
  if (ciudad === 'pachuca' || ciudad === 'ensenada' || ciudad === 'tijuana') return ciudad
  return 'tulancingo'
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function signJwt(payload: Record<string, unknown>) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`
  const key = PRIVATE_KEY || requireEnv('GOOGLE_WALLET_PRIVATE_KEY').replace(/\\n/g, '\n')
  const signature = createSign('RSA-SHA256').update(unsignedToken).end().sign(key)
  const signatureB64 = base64UrlEncode(signature)
  return `${unsignedToken}.${signatureB64}`
}

function loyaltyObjectFromMember(payload: LoyaltyObjectPayload) {
  return {
    id: payload.objectId,
    classId: payload.classId,
    state: 'ACTIVE',
    accountId: payload.userId,
    accountName: payload.nombre || 'Socio MUVET',
    loyaltyPoints: {
      label: 'VISITAS',
      balance: {
        string: `${payload.visitasUsadas}/${payload.visitasTotales}`,
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: payload.userId,
      alternateText: `MUVET-${String(payload.userId).substring(0, 8)}`,
    },
    textModulesData: [
      { id: 'plan', header: 'PLAN', body: payload.plan },
      { id: 'ciudad', header: 'CIUDAD', body: payload.ciudad },
      { id: 'vigencia', header: 'VÁLIDO HASTA', body: payload.fechaVencimiento },
    ],
    hexBackgroundColor: process.env.GOOGLE_WALLET_BG_COLOR || '#0A0A0A',
  }
}

function generateAddToWalletLink(loyaltyObject: ReturnType<typeof loyaltyObjectFromMember>) {
  const email = SERVICE_ACCOUNT_EMAIL || requireEnv('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL')
  const origin = process.env.GOOGLE_WALLET_ORIGIN || 'https://muvet.mx'
  const now = Math.floor(Date.now() / 1000)

  const jwtPayload = {
    iss: email,
    aud: 'google',
    typ: 'savetowallet',
    origins: [origin],
    iat: now,
    payload: {
      loyaltyObjects: [loyaltyObject],
    },
  }

  const jwt = signJwt(jwtPayload)
  return `https://pay.google.com/gp/v/save/${jwt}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as AddWalletBody
  const userId = body.user_id ?? body.userId
  if (!userId) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }
  if (userId !== user.id) {
    return NextResponse.json({ error: 'Sin permisos para este socio' }, { status: 403 })
  }

  const db = createServiceClient()
  const consultaConQr = await db
    .from('users')
    .select('id, nombre, plan, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code')
    .eq('id', userId)
    .maybeSingle<SocioRow>()

  let socio: SocioRow | null = null
  if (!consultaConQr.error) {
    socio = consultaConQr.data ?? null
  } else if (columnaNoExiste(consultaConQr.error, 'qr_code')) {
    const fallbackSinQr = await db
      .from('users')
      .select('id, nombre, plan, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra')
      .eq('id', userId)
      .maybeSingle<SocioRow>()
    if (fallbackSinQr.error) {
      console.error('[POST /api/wallet/google/add] error cargando socio:', fallbackSinQr.error)
      return NextResponse.json({ error: 'No se pudo cargar el socio' }, { status: 500 })
    }
    socio = fallbackSinQr.data ?? null
  } else {
    console.error('[POST /api/wallet/google/add] error cargando socio:', consultaConQr.error)
    return NextResponse.json({ error: 'No se pudo cargar el socio' }, { status: 500 })
  }

  if (!socio) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const planNormalizado = normalizarPlan(socio.plan) ?? 'basico'
  const plan = PLAN_LABELS[planNormalizado]
  const ciudad = ciudadSegura(socio.ciudad)
  const visitasTotales = PLAN_VISITAS_MENSUALES[planNormalizado] + Math.max(Math.trunc(socio.creditos_extra ?? 0), 0)

  let visitasUsadas = 0
  if (socio.fecha_inicio_ciclo && socio.fecha_fin_plan) {
    const { count } = await db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', socio.id)
      .gte('fecha', socio.fecha_inicio_ciclo)
      .lt('fecha', socio.fecha_fin_plan)
    visitasUsadas = count ?? 0
  } else {
    const { count } = await db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', socio.id)
    visitasUsadas = count ?? 0
  }

  const issuerId = ISSUER_ID || CLASS_ID.split('.')[0]
  const objectId = `${issuerId}.muvet-${userId}`

  const loyaltyObject = loyaltyObjectFromMember({
    objectId,
    classId: CLASS_ID,
    userId,
    nombre: (socio.nombre ?? user.email?.split('@')[0] ?? 'Socio MUVET').trim(),
    plan: plan as 'BÁSICO' | 'PLUS' | 'TOTAL',
    ciudad: CIUDAD_LABELS[ciudad],
    visitasUsadas,
    visitasTotales,
    fechaVencimiento: formatearFecha(socio.fecha_fin_plan),
  })

  let walletUrl = ''
  try {
    walletUrl = generateAddToWalletLink(loyaltyObject)
  } catch (error) {
    console.error('[POST /api/wallet/google/add] error generando JWT/link:', error)
    return NextResponse.json({ error: 'No se pudo generar walletUrl' }, { status: 500 })
  }

  await db.from('users').update({ wallet_google_agregado: true }).eq('id', userId)
  return NextResponse.json({ walletUrl, objectId })
}
