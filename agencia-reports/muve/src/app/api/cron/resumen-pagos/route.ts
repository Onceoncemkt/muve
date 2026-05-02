import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  normalizarPlan,
  resolverZonaNegocio,
  obtenerTarifasNegocioPorPlan,
} from '@/lib/planes'
import type { PlanMembresia } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NegocioRow = {
  id: string
  nombre: string
  categoria: string | null
  ciudad: string | null
  zona: string | null
  stripe_account_id: string | null
  activo: boolean | null
}

type VisitaRow = {
  negocio_id: string
  plan_usuario: string | null
  estado?: string | null
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
  estado: 'pendiente' | 'completado'
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

function periodoSemanaActual() {
  const hoy = inicioDiaUTC(new Date())
  const diaMondayIndex = (hoy.getUTCDay() + 6) % 7 // lunes=0 ... domingo=6

  const inicio = new Date(hoy)
  inicio.setUTCDate(inicio.getUTCDate() - diaMondayIndex)

  const fin = new Date(inicio)
  fin.setUTCDate(fin.getUTCDate() + 6)

  const finExclusivo = new Date(fin)
  finExclusivo.setUTCDate(finExclusivo.getUTCDate() + 1)

  return {
    inicioConsulta: inicio,
    finConsultaExclusivo: finExclusivo,
    inicioRegistro: formatoFechaISO(inicio),
    finRegistro: formatoFechaISO(fin),
  }
}

function crearResumenVacio() {
  return {
    basico: 0,
    plus: 0,
    total: 0,
  } satisfies Record<PlanMembresia, number>
}

function planTarifaParaVisita({
  categoria,
  zona,
  ciudad,
  planUsuario,
}: {
  categoria: string | null | undefined
  zona: string | null | undefined
  ciudad: string | null | undefined
  planUsuario: string | null | undefined
}) {
  const zonaNegocio = resolverZonaNegocio({ zona, ciudad })

  if (
    categoria
    && (
      (zonaNegocio === 'zona1' && categoria !== 'clases')
      || (zonaNegocio === 'zona2' && ['gimnasio', 'estetica', 'restaurante'].includes(categoria))
    )
  ) {
    return 'basico'
  }

  const plan = normalizarPlan(planUsuario)
  if (plan) return plan
  return null
}

function calcularSubtotal(cantidad: number, tarifa: number) {
  return cantidad * tarifa
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = createServiceClient()
  const { inicioConsulta, finConsultaExclusivo, inicioRegistro, finRegistro } = periodoSemanaActual()

  const { data: negocios, error: negociosError } = await db
    .from('negocios')
    .select('id, nombre, categoria, ciudad, zona, stripe_account_id, activo')
    .eq('activo', true)
    .returns<NegocioRow[]>()

  if (negociosError) {
    return NextResponse.json(
      { error: negociosError.message ?? 'No se pudieron cargar negocios activos' },
      { status: 500 }
    )
  }

  const negociosActivos = negocios ?? []
  if (negociosActivos.length === 0) {
    return NextResponse.json({
      ok: true,
      periodo: { inicio: inicioRegistro, fin: finRegistro },
      negocios_procesados: 0,
      total_general_mxn: 0,
    })
  }

  const { data: visitas, error: visitasError } = await db
    .from('visitas')
    .select('negocio_id, plan_usuario, estado')
    .in('negocio_id', negociosActivos.map((n) => n.id))
    .gte('fecha', inicioConsulta.toISOString())
    .lt('fecha', finConsultaExclusivo.toISOString())
    .neq('estado', 'no_show')
    .neq('estado', 'cancelado')
    .returns<VisitaRow[]>()

  if (visitasError) {
    return NextResponse.json(
      { error: visitasError.message ?? 'No se pudieron cargar check-ins del periodo' },
      { status: 500 }
    )
  }

  const resumenPorNegocio = new Map<string, Record<PlanMembresia, number>>()
  for (const negocio of negociosActivos) {
    resumenPorNegocio.set(negocio.id, crearResumenVacio())
  }

  const negocioPorId = new Map(negociosActivos.map((n) => [n.id, n]))

  for (const visita of visitas ?? []) {
    const negocio = negocioPorId.get(visita.negocio_id)
    if (!negocio) continue

    const categoria = negocio.categoria ?? null
    const plan = planTarifaParaVisita({
      categoria,
      zona: negocio.zona ?? null,
      ciudad: negocio.ciudad ?? null,
      planUsuario: visita.plan_usuario,
    })
    if (!plan) continue
    const resumen = resumenPorNegocio.get(visita.negocio_id)
    if (!resumen) continue
    resumen[plan] += 1
  }

  const registrosPago: RegistroPago[] = []
  const bloquesPorCiudad = new Map<string, string[]>()
  let totalGeneral = 0

  for (const negocio of negociosActivos) {
    const resumen = resumenPorNegocio.get(negocio.id) ?? crearResumenVacio()
    const zona = resolverZonaNegocio({ zona: negocio.zona, ciudad: negocio.ciudad })
    const tarifas = obtenerTarifasNegocioPorPlan(negocio.categoria, zona)

    const subtotalBasico = calcularSubtotal(resumen.basico, tarifas.basico)
    const subtotalPlus = calcularSubtotal(resumen.plus, tarifas.plus)
    const subtotalTotal = calcularSubtotal(resumen.total, tarifas.total)
    const totalNegocio = subtotalBasico + subtotalPlus + subtotalTotal
    totalGeneral += totalNegocio

    if (totalNegocio > 0) {
      registrosPago.push({
        negocio_id: negocio.id,
        periodo_inicio: inicioRegistro,
        periodo_fin: finRegistro,
        visitas_basico: resumen.basico,
        visitas_plus: resumen.plus,
        visitas_total: resumen.total,
        total_mxn: totalNegocio,
        stripe_transfer_id: null,
        estado: 'pendiente',
      })
    }

    const stripeWarning = negocio.stripe_account_id
      ? ''
      : '<p style="margin:8px 0 0; color:#EF4444; font-weight:800;">SIN CUENTA STRIPE — pago manual requerido</p>'

    const rowHtml = `
      <div style="margin: 0 0 16px; border:1px solid #1f2937; border-radius:10px; padding:14px; background:#0A0A0A;">
        <p style="margin:0 0 8px; color:#E8FF47; font-weight:900;">${escapeHtml(negocio.nombre)}</p>
        <p style="margin:0 0 8px; color:#9CA3AF; font-size:12px;">
          ${escapeHtml(negocio.ciudad ?? 'Sin ciudad')} · ${escapeHtml(zona.toUpperCase())} · ${escapeHtml(negocio.categoria ?? 'Sin categoría')}
        </p>
        <p style="margin:0; color:#E5E7EB; font-size:13px;">Básico: ${resumen.basico} × ${formatMoney(tarifas.basico)} = <strong>${formatMoney(subtotalBasico)}</strong></p>
        <p style="margin:4px 0 0; color:#E5E7EB; font-size:13px;">Plus: ${resumen.plus} × ${formatMoney(tarifas.plus)} = <strong>${formatMoney(subtotalPlus)}</strong></p>
        <p style="margin:4px 0 0; color:#E5E7EB; font-size:13px;">Total: ${resumen.total} × ${formatMoney(tarifas.total)} = <strong>${formatMoney(subtotalTotal)}</strong></p>
        <p style="margin:10px 0 0; color:#FFFFFF; font-weight:900;">TOTAL A PAGAR: ${formatMoney(totalNegocio)}</p>
        ${stripeWarning}
      </div>
    `

    const ciudadKey = negocio.ciudad ?? 'Sin ciudad'
    const list = bloquesPorCiudad.get(ciudadKey) ?? []
    list.push(rowHtml)
    bloquesPorCiudad.set(ciudadKey, list)
  }

  if (registrosPago.length > 0) {
    const { error: upsertError } = await db
      .from('pagos_negocios')
      .upsert(registrosPago, { onConflict: 'negocio_id,periodo_inicio,periodo_fin' })

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message ?? 'No se pudo registrar el resumen en pagos_negocios' },
        { status: 500 }
      )
    }
  }

  const adminEmail = process.env.EMAIL_ADMIN?.trim() || 'hola@muvet.mx'
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM

  const ciudadesOrdenadas = Array.from(bloquesPorCiudad.keys()).sort((a, b) => a.localeCompare(b, 'es'))
  const contenidoCiudades = ciudadesOrdenadas.map((ciudad) => `
    <h2 style="margin:20px 0 8px; color:#E8FF47; font-size:14px; text-transform:uppercase; letter-spacing:0.08em;">
      ${escapeHtml(ciudad)}
    </h2>
    ${(bloquesPorCiudad.get(ciudad) ?? []).join('')}
  `).join('')

  const asunto = `Resumen de pagos MUVET — Semana del ${inicioRegistro} al ${finRegistro}`
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; background:#000000; color:#FFFFFF; padding:24px;">
      <div style="max-width:760px; margin:0 auto; border:1px solid #1F2937; border-radius:12px; padding:24px; background:#050505;">
        <p style="margin:0; color:#9CA3AF; font-size:12px; letter-spacing:0.12em; text-transform:uppercase;">MUVET</p>
        <h1 style="margin:8px 0 0; color:#E8FF47; font-size:24px;">Relación de pagos semanales</h1>
        <p style="margin:12px 0 0; color:#D1D5DB; font-size:14px;">
          Fecha del resumen: ${escapeHtml(new Date().toLocaleString('es-MX'))}<br />
          Período cubierto: ${escapeHtml(inicioRegistro)} al ${escapeHtml(finRegistro)}
        </p>
        ${contenidoCiudades || '<p style="margin:20px 0 0; color:#D1D5DB;">Sin check-ins registrados esta semana.</p>'}
        <div style="margin-top:20px; border-top:1px solid #1F2937; padding-top:14px;">
          <p style="margin:0; color:#FFFFFF; font-size:16px; font-weight:900;">
            TOTAL GENERAL A PAGAR: ${formatMoney(totalGeneral)}
          </p>
          <p style="margin:8px 0 0; color:#9CA3AF; font-size:13px;">
            Los pagos se procesarán automáticamente mañana lunes a las 9am.
          </p>
        </div>
      </div>
    </div>
  `

  if (resendApiKey && fromEmail) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject: asunto,
          html,
        }),
      })
    } catch (error) {
      console.warn('[GET /api/cron/resumen-pagos] Error al enviar email de resumen', error)
    }
  }

  return NextResponse.json({
    ok: true,
    periodo: { inicio: inicioRegistro, fin: finRegistro },
    negocios_procesados: negociosActivos.length,
    registros_generados: registrosPago.length,
    total_general_mxn: totalGeneral,
    email_destino: adminEmail,
  })
}
