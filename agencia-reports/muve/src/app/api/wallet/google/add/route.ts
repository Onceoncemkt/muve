import { createHash, createSign } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_LABELS, CREDITOS_POR_PLAN, normalizarPlan } from '@/lib/planes'
import { calcularVisitasRestantes } from '@/lib/creditos'
import { CIUDAD_LABELS, type Ciudad } from '@/types'

export const runtime = 'nodejs'

function obtenerEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return ''
}

function parseServiceAccountKey(raw: string): { privateKey: string; clientEmail: string | null } {
  if (!raw) return { privateKey: '', clientEmail: null }
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { private_key?: string; client_email?: string }
      return {
        privateKey: (json.private_key ?? '').replace(/\\n/g, '\n'),
        clientEmail: typeof json.client_email === 'string' ? json.client_email : null,
      }
    } catch {
      return { privateKey: '', clientEmail: null }
    }
  }
  return { privateKey: trimmed.replace(/\\n/g, '\n'), clientEmail: null }
}

const ISSUER_ID = obtenerEnv('NEXT_PUBLIC_GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_ISSUER_ID')
const CLASS_SUFFIX = 'muvet_generic_v1'
const SERVICE_ACCOUNT_RAW = obtenerEnv('GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_WALLET_PRIVATE_KEY')
const PARSED_KEY = parseServiceAccountKey(SERVICE_ACCOUNT_RAW)
const PRIVATE_KEY = PARSED_KEY.privateKey
const SERVICE_ACCOUNT_EMAIL = obtenerEnv(
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_WALLET_CLIENT_EMAIL',
) || (PARSED_KEY.clientEmail ?? '')
const WALLET_ORIGIN = obtenerEnv('GOOGLE_WALLET_ORIGIN') || 'https://www.muvet.mx'
const LOGO_URL = obtenerEnv('GOOGLE_WALLET_LOGO_URL') || `${WALLET_ORIGIN}/icon-512.png`

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

type GenericPassPayload = {
  objectId: string
  classId: string
  userId: string
  nombre: string
  plan: 'BÁSICO' | 'PLUS' | 'TOTAL'
  ciudad: string
  creditosDisponibles: number
  fechaVencimiento: string
  qrValue: string
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

function requireEnv(name: string, value: string) {
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
  const key = requireEnv('GOOGLE_SERVICE_ACCOUNT_KEY', PRIVATE_KEY)
  const signature = createSign('RSA-SHA256').update(unsignedToken).end().sign(key)
  return `${unsignedToken}.${base64UrlEncode(signature)}`
}

function buildGenericClass(classId: string) {
  return {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['plan']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['ciudad']" }],
                },
              },
            },
          },
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['creditos']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['vigencia']" }],
                },
              },
            },
          },
        ],
      },
    },
  }
}

function buildGenericObject(payload: GenericPassPayload) {
  return {
    id: payload.objectId,
    classId: payload.classId,
    state: 'ACTIVE',
    hexBackgroundColor: '#6B4FE8',
    logo: {
      sourceUri: {
        uri: LOGO_URL,
      },
      contentDescription: {
        defaultValue: { language: 'es-MX', value: 'MUVET' },
      },
    },
    cardTitle: {
      defaultValue: { language: 'es-MX', value: 'MUVET' },
    },
    subheader: {
      defaultValue: { language: 'es-MX', value: 'Wellness Club' },
    },
    header: {
      defaultValue: { language: 'es-MX', value: payload.nombre },
    },
    textModulesData: [
      { id: 'plan', header: 'PLAN', body: payload.plan },
      { id: 'ciudad', header: 'CIUDAD', body: payload.ciudad },
      { id: 'creditos', header: 'CRÉDITOS', body: `${payload.creditosDisponibles} disponibles` },
      { id: 'vigencia', header: 'VÁLIDO HASTA', body: payload.fechaVencimiento },
    ],
    barcode: {
      type: 'QR_CODE',
      value: payload.qrValue,
      alternateText: 'Pase MUVET',
    },
  }
}

function generateAddToWalletLink(
  genericObject: ReturnType<typeof buildGenericObject>,
  genericClass: ReturnType<typeof buildGenericClass>,
) {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', SERVICE_ACCOUNT_EMAIL)
  const now = Math.floor(Date.now() / 1000)

  const jwtPayload = {
    iss: email,
    aud: 'google',
    typ: 'savetowallet',
    origins: [WALLET_ORIGIN],
    iat: now,
    payload: {
      genericClasses: [genericClass],
      genericObjects: [genericObject],
    },
  }

  const jwt = signJwt(jwtPayload)
  return { walletUrl: `https://pay.google.com/gp/v/save/${jwt}`, jwtPayload, jwt }
}

function serializarError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    }
  }
  try {
    return JSON.parse(JSON.stringify(error))
  } catch {
    return String(error)
  }
}

export async function POST(request: NextRequest) {
  console.log('[wallet/google/add] env diagnostics:', {
    issuerId: ISSUER_ID || '(unset)',
    serviceAccountEmail: SERVICE_ACCOUNT_EMAIL || '(unset)',
    privateKeyPresent: PRIVATE_KEY.length > 0,
    privateKeyLength: PRIVATE_KEY.length,
    walletOrigin: WALLET_ORIGIN,
    logoUrl: LOGO_URL,
  })

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
      console.error('[wallet/google/add] error cargando socio:', JSON.stringify(serializarError(fallbackSinQr.error), null, 2))
      return NextResponse.json({ error: 'No se pudo cargar el socio' }, { status: 500 })
    }
    socio = fallbackSinQr.data ?? null
  } else {
    console.error('[wallet/google/add] error cargando socio:', JSON.stringify(serializarError(consultaConQr.error), null, 2))
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
  const visitasTotales = visitasIncluidasPlan + creditosExtra
  const fallbackDisponibles = Math.max(visitasTotales - visitasUsadas, 0)
  const creditos = creditosDisponibles || fallbackDisponibles

  const issuerId = ISSUER_ID || (process.env.GOOGLE_WALLET_CLASS_ID?.split('.')[0] ?? '')
  if (!issuerId) {
    console.error('[wallet/google/add] issuer ID no configurado')
    return NextResponse.json({ error: 'Falta NEXT_PUBLIC_GOOGLE_WALLET_ISSUER_ID' }, { status: 500 })
  }
  const classId = `${issuerId}.${CLASS_SUFFIX}`
  const objectId = `${issuerId}.muvet-${userId}`
  const qrValue = (socio.qr_code && socio.qr_code.trim().length > 0)
    ? socio.qr_code.trim()
    : createHash('sha256').update(userId).digest('hex')

  const genericClass = buildGenericClass(classId)
  const genericObject = buildGenericObject({
    objectId,
    classId,
    userId,
    nombre: (socio.nombre ?? user.email?.split('@')[0] ?? 'Socio MUVET').trim(),
    plan: plan as 'BÁSICO' | 'PLUS' | 'TOTAL',
    ciudad: CIUDAD_LABELS[ciudad],
    creditosDisponibles: creditos,
    fechaVencimiento: formatearFecha(socio.fecha_fin_plan),
    qrValue,
  })

  try {
    const { walletUrl, jwtPayload, jwt } = generateAddToWalletLink(genericObject, genericClass)
    console.log('[wallet/google/add] JWT generado', {
      classId,
      objectId,
      issuer: jwtPayload.iss,
      origins: jwtPayload.origins,
      jwtLength: jwt.length,
      walletUrlLength: walletUrl.length,
    })
    await db.from('users').update({ wallet_google_agregado: true }).eq('id', userId)
    return NextResponse.json({ walletUrl, objectId })
  } catch (error) {
    console.error('Google Wallet error:', JSON.stringify(serializarError(error), null, 2))
    console.error('[wallet/google/add] payload inputs:', {
      issuerId,
      classId,
      objectId,
      logoUrl: LOGO_URL,
      origin: WALLET_ORIGIN,
      serviceAccountEmail: SERVICE_ACCOUNT_EMAIL,
      privateKeyLen: PRIVATE_KEY.length,
    })
    const message = error instanceof Error ? error.message : 'No se pudo generar walletUrl'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
