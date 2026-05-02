import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { enviarPushAUsuarios } from '@/lib/push/server'
import { getEmailFrom } from '@/lib/email'
import { normalizarPlan, obtenerStripePriceIdsPorRegion } from '@/lib/planes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type UsuarioRecordatorio = {
  id: string
  nombre: string | null
  email: string | null
  ciudad: string | null
  plan: string | null
  stripe_customer_id: string | null
  fecha_fin_plan: string
}

const { centro: PRICE_IDS_CENTRO, bc: PRICE_IDS_BC } = obtenerStripePriceIdsPorRegion()

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

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function esCiudadBC(ciudad: string | null | undefined) {
  return ciudad === 'tijuana'
}

function normalizarTexto(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function inicioDiaUTC(fecha: Date) {
  const inicio = new Date(fecha)
  inicio.setUTCHours(0, 0, 0, 0)
  return inicio
}

function calcularDiasRestantes(fechaFinPlan: string) {
  const fecha = new Date(fechaFinPlan)
  if (Number.isNaN(fecha.getTime())) return null

  const inicioHoy = inicioDiaUTC(new Date())
  const inicioFin = inicioDiaUTC(fecha)
  const diferenciaMs = inicioFin.getTime() - inicioHoy.getTime()
  return Math.round(diferenciaMs / (24 * 60 * 60 * 1000))
}

function plantillaRecordatorio({
  nombreUsuario,
  diasRestantes,
  checkoutUrl,
  ctaLabel,
}: {
  nombreUsuario: string
  diasRestantes: number
  checkoutUrl: string
  ctaLabel: string
}) {
  const nombreSeguro = escapeHtml(nombreUsuario)
  const checkoutSeguro = escapeHtml(checkoutUrl)
  const ctaSeguro = escapeHtml(ctaLabel)
  const diasTexto = diasRestantes === 1 ? '1 día' : `${diasRestantes} días`

  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0A0A0A; color: #ffffff; padding: 24px;">
      <div style="max-width: 520px; margin: 0 auto; border: 1px solid #1f1f1f; border-radius: 12px; padding: 24px;">
        <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #9ca3af; margin: 0 0 16px;">MUVET</p>
        <h1 style="font-size: 28px; line-height: 1.2; margin: 0 0 16px;">Tu membresía está por vencer</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 12px;">
          Hola ${nombreSeguro}, tu membresía MUVET vence en <strong>${escapeHtml(diasTexto)}</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 20px;">
          Renuévala ahora para no perder acceso a gimnasios, clases, wellness y restaurantes.
        </p>
        <a href="${checkoutSeguro}" style="display: inline-block; background: #E8FF47; color: #0A0A0A; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px;">
          ${ctaSeguro}
        </a>
      </div>
    </div>
  `
}

async function enviarEmailRecordatorio({
  email,
  nombreUsuario,
  diasRestantes,
  checkoutUrl,
}: {
  email: string
  nombreUsuario: string
  diasRestantes: number
  checkoutUrl: string
}) {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = getEmailFrom()
  if (!resendApiKey) return false

  const subject = diasRestantes === 3
    ? 'Tu membresía MUVET vence en 3 días'
    : 'Último día de tu membresía MUVET'
  const ctaLabel = diasRestantes === 3
    ? 'Renovar ahora'
    : 'Renovar antes de que expire'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html: plantillaRecordatorio({
        nombreUsuario,
        diasRestantes,
        checkoutUrl,
        ctaLabel,
      }),
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    console.warn('[GET /api/cron/recordatorio-plan] Error Resend', {
      status: response.status,
      payload,
    })
    return false
  }

  return true
}

function obtenerPriceIdParaRenovacion(usuario: UsuarioRecordatorio) {
  const plan = normalizarPlan(usuario.plan)
  if (!plan) return null
  const priceIds = esCiudadBC(usuario.ciudad) ? PRICE_IDS_BC : PRICE_IDS_CENTRO
  return priceIds[plan] ?? null
}

async function asegurarCustomerId(db: ReturnType<typeof createServiceClient>, usuario: UsuarioRecordatorio) {
  if (usuario.stripe_customer_id) return usuario.stripe_customer_id

  const email = normalizarTexto(usuario.email)
  if (!email) return null

  const customer = await stripe.customers.create({
    email,
    name: normalizarTexto(usuario.nombre) || undefined,
    metadata: { supabase_user_id: usuario.id },
  })

  const { error } = await db
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', usuario.id)

  if (error) {
    console.warn('[GET /api/cron/recordatorio-plan] No se pudo persistir stripe_customer_id', {
      user_id: usuario.id,
      error: error.message,
    })
  }

  return customer.id
}

async function crearCheckoutRenovacion(
  db: ReturnType<typeof createServiceClient>,
  usuario: UsuarioRecordatorio,
  origin: string
) {
  const fallback = `${origin}/planes`
  const priceId = obtenerPriceIdParaRenovacion(usuario)
  if (!priceId) return fallback

  const customerId = await asegurarCustomerId(db, usuario)
  if (!customerId) return fallback

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?membresia=activada`,
      cancel_url: `${origin}/planes`,
      metadata: { supabase_user_id: usuario.id },
      subscription_data: {
        metadata: { supabase_user_id: usuario.id },
      },
    })

    return session.url ?? fallback
  } catch (error) {
    console.warn('[GET /api/cron/recordatorio-plan] Error creando checkout de renovación', {
      user_id: usuario.id,
      error: error instanceof Error ? error.message : 'error desconocido',
    })
    return fallback
  }
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = createServiceClient()
  const inicioHoy = inicioDiaUTC(new Date())
  const limiteBusqueda = new Date(inicioHoy)
  limiteBusqueda.setUTCDate(limiteBusqueda.getUTCDate() + 4)

  let usuarios: UsuarioRecordatorio[] = []
  const consultaPrincipal = await db
    .from('users')
    .select('id, nombre, email, ciudad, plan, stripe_customer_id, fecha_fin_plan')
    .eq('plan_activo', true)
    .gte('fecha_fin_plan', inicioHoy.toISOString())
    .lt('fecha_fin_plan', limiteBusqueda.toISOString())
    .returns<UsuarioRecordatorio[]>()

  if (!consultaPrincipal.error) {
    usuarios = consultaPrincipal.data ?? []
  } else if (faltaColumna(consultaPrincipal.error, 'fecha_fin_plan')) {
    return NextResponse.json(
      { error: 'Falta la columna users.fecha_fin_plan. Ejecuta la migración 018 en Supabase.' },
      { status: 500 }
    )
  } else if (
    faltaColumna(consultaPrincipal.error, 'plan')
    || faltaColumna(consultaPrincipal.error, 'stripe_customer_id')
  ) {
    const fallback = await db
      .from('users')
      .select('id, nombre, email, ciudad, fecha_fin_plan')
      .eq('plan_activo', true)
      .gte('fecha_fin_plan', inicioHoy.toISOString())
      .lt('fecha_fin_plan', limiteBusqueda.toISOString())
      .returns<Array<Omit<UsuarioRecordatorio, 'plan' | 'stripe_customer_id'>>>()

    if (fallback.error) {
      return NextResponse.json(
        { error: fallback.error.message ?? 'No se pudieron cargar usuarios a recordar' },
        { status: 500 }
      )
    }

    usuarios = (fallback.data ?? []).map((usuario) => ({
      ...usuario,
      plan: null,
      stripe_customer_id: null,
    }))
  } else {
    return NextResponse.json(
      { error: consultaPrincipal.error.message ?? 'No se pudieron cargar usuarios a recordar' },
      { status: 500 }
    )
  }

  const objetivos = usuarios
    .map((usuario) => ({
      ...usuario,
      dias_restantes: calcularDiasRestantes(usuario.fecha_fin_plan),
    }))
    .filter((usuario) => usuario.dias_restantes === 3 || usuario.dias_restantes === 1)

  const origin = new URL(request.url).origin
  let pushEnviados = 0
  let emailsEnviados = 0

  for (const usuario of objetivos) {
    const diasRestantes = usuario.dias_restantes as number
    const diasLabel = diasRestantes === 1 ? '1 día' : `${diasRestantes} días`

    const pushResult = await enviarPushAUsuarios(
      [usuario.id],
      {
        title: 'MUVET',
        body: `Tu membresía MUVET vence en ${diasLabel}. Renuévala para no perder acceso.`,
        url: '/planes',
      }
    )
    if (pushResult.sent > 0) pushEnviados += 1

    const email = normalizarTexto(usuario.email).toLowerCase()
    if (!email) continue

    const checkoutUrl = await crearCheckoutRenovacion(db, usuario, origin)
    const emailOk = await enviarEmailRecordatorio({
      email,
      nombreUsuario: normalizarTexto(usuario.nombre) || 'usuario',
      diasRestantes,
      checkoutUrl,
    })
    if (emailOk) emailsEnviados += 1
  }

  return NextResponse.json({
    ok: true,
    candidatos: objetivos.length,
    push_notificados: pushEnviados,
    emails_enviados: emailsEnviados,
  })
}
