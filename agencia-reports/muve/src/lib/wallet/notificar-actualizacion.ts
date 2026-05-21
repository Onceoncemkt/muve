import { createServiceClient } from '@/lib/supabase/service'
import { CREDITOS_POR_PLAN, PLAN_LABELS, normalizarPlan } from '@/lib/planes'
import { calcularVisitasRestantes } from '@/lib/creditos'
import { camposPaseWallet } from './pase-campos'
import { CIUDAD_LABELS, type Ciudad } from '@/types'
import { enviarApnsPush } from './apple-apns'
import { patchGenericObject } from './google-wallet-api'

type SocioRow = {
  id: string
  plan: string | null
  plan_activo: boolean | string | number | null
  ciudad: Ciudad | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
  creditos_extra: number | null
}

type WalletRegistrationRow = {
  push_token: string
  pass_type_id: string
  serial_number: string
}

function ciudadSegura(ciudad: Ciudad | null | undefined): Ciudad {
  if (ciudad === 'pachuca' || ciudad === 'ensenada' || ciudad === 'tijuana' || ciudad === 'tecate') return ciudad
  return 'tulancingo'
}

function formatearFecha(value: string | null | undefined) {
  if (!value) return 'Sin definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin definir'
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

async function notificarAppleWallet(userId: string): Promise<void> {
  const db = createServiceClient()
  const { data: registros, error } = await db
    .from('wallet_registrations')
    .select('push_token, pass_type_id, serial_number')
    .eq('user_id', userId)
    .returns<WalletRegistrationRow[]>()

  if (error) {
    console.error('[notificarAppleWallet] error consultando registros:', error)
    return
  }
  if (!registros || registros.length === 0) return

  const tokens = Array.from(new Set(registros.map(r => r.push_token).filter(Boolean)))
  try {
    const resultados = await enviarApnsPush(tokens)
    const failures = resultados.filter(r => r.status >= 400)
    if (failures.length > 0) {
      console.warn('[notificarAppleWallet] APNs failures:', failures)
      const tokensInvalidos = failures
        .filter(r => r.status === 410 || r.reason === 'BadDeviceToken')
        .map(r => r.pushToken)
      if (tokensInvalidos.length > 0) {
        await db
          .from('wallet_registrations')
          .delete()
          .in('push_token', tokensInvalidos)
      }
    }
  } catch (error) {
    console.error('[notificarAppleWallet] APNs error:', error)
  }
}

async function notificarGoogleWallet(userId: string): Promise<void> {
  const issuerId =
    process.env.NEXT_PUBLIC_GOOGLE_WALLET_ISSUER_ID?.trim()
    ?? process.env.GOOGLE_WALLET_ISSUER_ID?.trim()
    ?? ''
  if (!issuerId) return

  const db = createServiceClient()
  const { data: socio, error } = await db
    .from('users')
    .select('id, plan, plan_activo, ciudad, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra')
    .eq('id', userId)
    .maybeSingle<SocioRow>()

  if (error || !socio) {
    if (error) console.error('[notificarGoogleWallet] error cargando socio:', error)
    return
  }

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
      .eq('user_id', userId)
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

  const campos = camposPaseWallet({
    planActivo: socio.plan_activo,
    plan: socio.plan,
    planLabelActivo: plan,
    creditosDisponibles: creditos,
    validoHastaActivo: formatearFecha(socio.fecha_fin_plan),
  })

  const objectId = `${issuerId}.muvet-${userId}`
  const result = await patchGenericObject({
    objectId,
    textModulesData: [
      { id: 'plan', header: 'PLAN', body: campos.planLabel },
      { id: 'ciudad', header: 'CIUDAD', body: CIUDAD_LABELS[ciudad] },
      { id: 'creditos', header: 'CRÉDITOS', body: campos.creditosTexto },
      { id: 'vigencia', header: 'VÁLIDO HASTA', body: campos.validoHasta },
    ],
  })

  if (!result.ok) {
    // 404 normalmente significa que el usuario nunca guardó el pase de Google;
    // no es un error crítico, solo se omite.
    if (result.status === 404) return
    console.warn('[notificarGoogleWallet] patch falló:', result)
  }
}

export async function notificarActualizacionWallet(userId: string): Promise<void> {
  if (!userId) return
  await Promise.allSettled([
    notificarAppleWallet(userId),
    notificarGoogleWallet(userId),
  ])
}
