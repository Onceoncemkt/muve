import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import {
  normalizarCategoriaNegocio,
  normalizarPlan,
  obtenerTarifasNegocioPorPlan,
} from '@/lib/planes'
import type { PlanMembresia } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NegocioConStripe = {
  id: string
  nombre: string
  categoria: string | null
  stripe_account_id: string | null
}

type VisitaPeriodo = {
  negocio_id: string
  plan_usuario: string | null
}

type PagoExistente = {
  negocio_id: string
}

type RegistroPago = {
  negocio_id: string
  periodo_inicio: string
  periodo_fin: string
  visitas_basico: number
  visitas_plus: number
  visitas_total: number
  total_mxn: number
  stripe_transfer_id: string | null
  estado: 'completado' | 'pendiente'
}


function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function planTarifaParaVisita({
  categoria,
  planUsuario,
}: {
  categoria: string | null | undefined
  planUsuario: string | null | undefined
}) {

  const categoriaNormalizada = normalizarCategoriaNegocio(categoria)
  if (categoriaNormalizada && categoriaNormalizada !== 'clases') {
    return 'basico'
  }
  const planNormalizado = normalizarPlan(planUsuario)
  if (planNormalizado) return planNormalizado

  return null
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

function inicioDiaUTC(fecha: Date) {
  const inicio = new Date(fecha)
  inicio.setUTCHours(0, 0, 0, 0)
  return inicio
}

function formatoFechaISO(fecha: Date) {
  return fecha.toISOString().split('T')[0]
}

function crearResumenVacio() {
  return {
    basico: 0,
    plus: 0,
    total: 0,
  } satisfies Record<PlanMembresia, number>
}

function obtenerPeriodoSemanal() {
  const finExclusivo = inicioDiaUTC(new Date())
  const inicio = new Date(finExclusivo)
  inicio.setUTCDate(inicio.getUTCDate() - 7)

  const finInclusivo = new Date(finExclusivo)
  finInclusivo.setUTCDate(finInclusivo.getUTCDate() - 1)

  return {
    inicioConsulta: inicio,
    finConsultaExclusivo: finExclusivo,
    inicioRegistro: formatoFechaISO(inicio),
    finRegistro: formatoFechaISO(finInclusivo),
  }
}

function calcularTotalMXN(
  resumen: Record<PlanMembresia, number>,
  tarifasPorPlan: Record<PlanMembresia, number>
) {
  return (
    (resumen.basico * tarifasPorPlan.basico)
    + (resumen.plus * tarifasPorPlan.plus)
    + (resumen.total * tarifasPorPlan.total)
  )
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function faltaRelacion(error: { message?: string } | null | undefined, relacion: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relacion.toLowerCase()) && message.includes('does not exist')
}

function mensajeError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Error desconocido'
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = admin()
  const { inicioConsulta, finConsultaExclusivo, inicioRegistro, finRegistro } = obtenerPeriodoSemanal()

  const { data: negocios, error: negociosError } = await db
    .from('negocios')
    .select('id, nombre, categoria, stripe_account_id')
    .not('stripe_account_id', 'is', null)
    .returns<NegocioConStripe[]>()

  if (faltaColumna(negociosError, 'stripe_account_id')) {
    return NextResponse.json(
      { error: 'Falta la columna negocios.stripe_account_id. Ejecuta la migración 016.' },
      { status: 500 }
    )
  }

  if (negociosError) {
    return NextResponse.json(
      { error: negociosError.message ?? 'No se pudieron cargar negocios con Stripe' },
      { status: 500 }
    )
  }

  const negociosConStripe = (negocios ?? []).filter(negocio => (
    typeof negocio.stripe_account_id === 'string' && negocio.stripe_account_id.trim().length > 0
  ))

  if (negociosConStripe.length === 0) {
    return NextResponse.json({
      ok: true,
      periodo: { inicio: inicioRegistro, fin: finRegistro },
      negocios_conectados: 0,
      negocios_procesados: 0,
      pagos_generados: 0,
      pagos_completados: 0,
      pagos_pendientes: 0,
      negocios_sin_movimientos: 0,
    })
  }

  const idsNegociosConStripe = negociosConStripe.map(negocio => negocio.id)
  const { data: pagosExistentes, error: pagosExistentesError } = await db
    .from('pagos_negocios')
    .select('negocio_id')
    .in('negocio_id', idsNegociosConStripe)
    .eq('periodo_inicio', inicioRegistro)
    .eq('periodo_fin', finRegistro)
    .returns<PagoExistente[]>()

  if (faltaRelacion(pagosExistentesError, 'pagos_negocios')) {
    return NextResponse.json(
      { error: 'Falta la tabla pagos_negocios. Ejecuta la migración 016.' },
      { status: 500 }
    )
  }

  if (pagosExistentesError) {
    return NextResponse.json(
      { error: pagosExistentesError.message ?? 'No se pudieron consultar pagos existentes' },
      { status: 500 }
    )
  }

  const negociosConPagoPrevio = new Set((pagosExistentes ?? []).map(pago => pago.negocio_id))
  const negociosPendientes = negociosConStripe.filter(
    negocio => !negociosConPagoPrevio.has(negocio.id)
  )

  if (negociosPendientes.length === 0) {
    return NextResponse.json({
      ok: true,
      periodo: { inicio: inicioRegistro, fin: finRegistro },
      negocios_conectados: negociosConStripe.length,
      negocios_procesados: 0,
      pagos_generados: 0,
      pagos_completados: 0,
      pagos_pendientes: 0,
      negocios_sin_movimientos: 0,
    })
  }

  const { data: visitasPeriodo, error: visitasError } = await db
    .from('visitas')
    .select('negocio_id, plan_usuario')
    .in('negocio_id', negociosPendientes.map(negocio => negocio.id))
    .gte('fecha', inicioConsulta.toISOString())
    .lt('fecha', finConsultaExclusivo.toISOString())
    .returns<VisitaPeriodo[]>()

  if (faltaColumna(visitasError, 'plan_usuario')) {
    return NextResponse.json(
      { error: 'Falta la columna visitas.plan_usuario. Ejecuta la migración 015.' },
      { status: 500 }
    )
  }

  if (visitasError) {
    return NextResponse.json(
      { error: visitasError.message ?? 'No se pudieron cargar visitas del periodo' },
      { status: 500 }
    )
  }

  const resumenPorNegocio = new Map<string, Record<PlanMembresia, number>>()
  for (const negocio of negociosPendientes) {
    resumenPorNegocio.set(negocio.id, crearResumenVacio())
  }
  const categoriaPorNegocioId = new Map(
    negociosPendientes.map((negocio) => [negocio.id, negocio.categoria])
  )

  for (const visita of visitasPeriodo ?? []) {
    const categoriaNegocio = categoriaPorNegocioId.get(visita.negocio_id) ?? null
    const plan = planTarifaParaVisita({
      categoria: categoriaNegocio,
      planUsuario: visita.plan_usuario,
    })
    if (!plan) continue
    const resumen = resumenPorNegocio.get(visita.negocio_id)
    if (!resumen) continue
    resumen[plan] += 1
  }

  const registrosPago: RegistroPago[] = []
  let pagosCompletados = 0
  let pagosPendientes = 0

  for (const negocio of negociosPendientes) {
    const resumen = resumenPorNegocio.get(negocio.id) ?? crearResumenVacio()
    const tarifasPorPlan = obtenerTarifasNegocioPorPlan(negocio.categoria)
    const totalMXN = calcularTotalMXN(resumen, tarifasPorPlan)

    if (totalMXN <= 0) {
      continue
    }

    let stripeTransferId: string | null = null
    let estado: 'completado' | 'pendiente' = 'completado'

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: totalMXN * 100,
          currency: 'mxn',
          destination: negocio.stripe_account_id!,
          metadata: {
            negocio_id: negocio.id,
            periodo_inicio: inicioRegistro,
            periodo_fin: finRegistro,
            visitas_basico: String(resumen.basico),
            visitas_plus: String(resumen.plus),
            visitas_total: String(resumen.total),
          },
        },
        {
          idempotencyKey: `pago-negocio-${negocio.id}-${inicioRegistro}-${finRegistro}`,
        }
      )
      stripeTransferId = transfer.id
      pagosCompletados += 1
    } catch (error) {
      estado = 'pendiente'
      pagosPendientes += 1
      console.error(
        `[GET /api/cron/pagar-negocios] transfer error negocio=${negocio.id}:`,
        mensajeError(error)
      )
    }

    registrosPago.push({
      negocio_id: negocio.id,
      periodo_inicio: inicioRegistro,
      periodo_fin: finRegistro,
      visitas_basico: resumen.basico,
      visitas_plus: resumen.plus,
      visitas_total: resumen.total,
      total_mxn: totalMXN,
      stripe_transfer_id: stripeTransferId,
      estado,
    })
  }

  if (registrosPago.length > 0) {
    const { error: upsertError } = await db
      .from('pagos_negocios')
      .upsert(registrosPago, { onConflict: 'negocio_id,periodo_inicio,periodo_fin' })

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message ?? 'No se pudieron registrar pagos de negocios' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    periodo: { inicio: inicioRegistro, fin: finRegistro },
    negocios_conectados: negociosConStripe.length,
    negocios_procesados: negociosPendientes.length,
    pagos_generados: registrosPago.length,
    pagos_completados: pagosCompletados,
    pagos_pendientes: pagosPendientes,
    negocios_sin_movimientos: negociosPendientes.length - registrosPago.length,
  })
}
