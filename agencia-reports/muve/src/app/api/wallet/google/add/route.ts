import { createHash } from 'crypto'
import path from 'path'
import { pathToFileURL } from 'url'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_LABELS, PLAN_VISITAS_MENSUALES, normalizarPlan } from '@/lib/planes'
import { CIUDAD_LABELS, type Ciudad } from '@/types'

export const runtime = 'nodejs'

const LOYALTY_CLASS_ID = '3388000000023124514.muvetmembershipv1'
const CREATE_OBJECT_MODULE_PATH = path.resolve(process.cwd(), 'wallet-integration/src/createObject.js')
const GENERATE_JWT_MODULE_PATH = path.resolve(process.cwd(), 'wallet-integration/src/generateJWT.js')

type AddWalletBody = { userId?: string }

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

type CreateMuvetObjectFn = (payload: {
  objectId: string
  classId: string
  nombre: string
  plan: 'BÁSICO' | 'PLUS' | 'TOTAL'
  ciudad: string
  visitasUsadas: number
  visitasTotales: number
  fechaVencimiento: string
  idSocio: string
  qrCode: string
}, options?: { updateIfExists?: boolean }) => Promise<unknown>

type GenerateAddToWalletLinkFn = (payload: { objectId: string }) => Promise<string> | string

function columnaNoExiste(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function resolverFuncionModulo<T extends (...args: never[]) => unknown>(
  moduleValue: unknown,
  functionName: string
): T | null {
  if (!moduleValue || typeof moduleValue !== 'object') return null
  const record = moduleValue as Record<string, unknown>
  if (typeof record[functionName] === 'function') return record[functionName] as T
  const defaultExport = record.default
  if (defaultExport && typeof defaultExport === 'object') {
    const nested = defaultExport as Record<string, unknown>
    if (typeof nested[functionName] === 'function') return nested[functionName] as T
  }
  return null
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

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as AddWalletBody
  if (!body.userId) {
    return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
  }
  if (body.userId !== user.id) {
    return NextResponse.json({ error: 'Sin permisos para este socio' }, { status: 403 })
  }

  const db = createServiceClient()

  const consultaConQr = await db
    .from('users')
    .select('id, nombre, plan, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code')
    .eq('id', user.id)
    .maybeSingle<SocioRow>()

  let socio: SocioRow | null = null
  if (!consultaConQr.error) {
    socio = consultaConQr.data ?? null
  } else if (columnaNoExiste(consultaConQr.error, 'qr_code')) {
    const fallbackSinQr = await db
      .from('users')
      .select('id, nombre, plan, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra')
      .eq('id', user.id)
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

  const createModule = await import(pathToFileURL(CREATE_OBJECT_MODULE_PATH).href)
  const jwtModule = await import(pathToFileURL(GENERATE_JWT_MODULE_PATH).href)
  const createMuvetObject = resolverFuncionModulo<CreateMuvetObjectFn>(createModule, 'createMuvetObject')
  const generateAddToWalletLink = resolverFuncionModulo<GenerateAddToWalletLinkFn>(jwtModule, 'generateAddToWalletLink')

  if (!createMuvetObject || !generateAddToWalletLink) {
    return NextResponse.json(
      { error: 'No se pudieron importar createMuvetObject o generateAddToWalletLink' },
      { status: 500 }
    )
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

  const issuerId = LOYALTY_CLASS_ID.split('.')[0]
  const objectId = `${issuerId}.muvet_${socio.id.replace(/[^a-zA-Z0-9]/g, '')}`
  const qrCode = socio.qr_code || createHash('sha256').update(socio.id).digest('hex')

  try {
    await createMuvetObject({
      objectId,
      classId: LOYALTY_CLASS_ID,
      nombre: (socio.nombre ?? user.email?.split('@')[0] ?? 'Socio MUVET').trim(),
      plan: plan as 'BÁSICO' | 'PLUS' | 'TOTAL',
      ciudad: CIUDAD_LABELS[ciudad],
      visitasUsadas,
      visitasTotales,
      fechaVencimiento: formatearFecha(socio.fecha_fin_plan),
      idSocio: socio.id,
      qrCode,
    }, { updateIfExists: true })
  } catch (error) {
    console.error('[POST /api/wallet/google/add] error creando/actualizando object:', error)
    return NextResponse.json({ error: 'No se pudo crear el objeto de Wallet' }, { status: 500 })
  }

  const walletUrl = await generateAddToWalletLink({ objectId })
  if (!walletUrl || !walletUrl.startsWith('https://pay.google.com/gp/v/save/')) {
    return NextResponse.json({ error: 'No se pudo generar walletUrl' }, { status: 500 })
  }

  await db.from('users').update({ wallet_google_agregado: true }).eq('id', user.id)
  return NextResponse.json({ walletUrl })
}
