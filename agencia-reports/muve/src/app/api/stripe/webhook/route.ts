import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { planDesdePriceId } from '@/lib/planes'
import type { PlanMembresia } from '@/types'

// Service role para saltarse RLS — solo en server, nunca exponer al cliente
function serviceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (key.startsWith('tsb_secret_')) {
    return key.replace(/^tsb_secret_/, 'sb_secret_')
  }
  return key
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey()
  )
}

function columnaPlanNoExiste(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('plan')
}

function columnaFechaFinPlanNoExiste(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('fecha_fin_plan')
}

function faltaRelacion(error: { message?: string } | null | undefined, relation: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
}

async function activarMembresia(
  customerId: string,
  subscriptionId: string,
  plan: PlanMembresia,
  fechaFinPlan: string | null
) {
  const supabase = getServiceClient()
  let { error } = await supabase
    .from('users')
    .update({
      plan_activo: true,
      stripe_subscription_id: subscriptionId,
      plan,
      fecha_fin_plan: fechaFinPlan,
    })
    .eq('stripe_customer_id', customerId)

  if (columnaPlanNoExiste(error) || columnaFechaFinPlanNoExiste(error)) {
    const fallbackPayload: Record<string, unknown> = {
      plan_activo: true,
      stripe_subscription_id: subscriptionId,
    }
    if (!columnaPlanNoExiste(error)) {
      fallbackPayload.plan = plan
    }
    if (!columnaFechaFinPlanNoExiste(error)) {
      fallbackPayload.fecha_fin_plan = fechaFinPlan
    }

    const fallback = await supabase
      .from('users')
      .update(fallbackPayload)
      .eq('stripe_customer_id', customerId)
    error = fallback.error
  }

  if (error) throw new Error(`activarMembresia: ${error.message}`)
}

async function desactivarMembresia(customerId: string) {
  const supabase = getServiceClient()
  let { error } = await supabase
    .from('users')
    .update({
      plan_activo: false,
      stripe_subscription_id: null,
      plan: null,
      fecha_fin_plan: null,
    })
    .eq('stripe_customer_id', customerId)

  if (columnaPlanNoExiste(error) || columnaFechaFinPlanNoExiste(error)) {
    const fallbackPayload: Record<string, unknown> = {
      plan_activo: false,
      stripe_subscription_id: null,
    }
    if (!columnaPlanNoExiste(error)) {
      fallbackPayload.plan = null
    }
    if (!columnaFechaFinPlanNoExiste(error)) {
      fallbackPayload.fecha_fin_plan = null
    }

    const fallback = await supabase
      .from('users')
      .update(fallbackPayload)
      .eq('stripe_customer_id', customerId)
    error = fallback.error
  }

  if (error) throw new Error(`desactivarMembresia: ${error.message}`)
}

async function obtenerDatosSubscription(subscriptionId: string): Promise<{
  plan: PlanMembresia
  fechaFinPlan: string | null
}> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price?.id
  const plan = planDesdePriceId(priceId)
  if (!plan) {
    throw new Error(`price_id no mapeado para membresía: ${priceId ?? 'desconocido'}`)
  }
  const currentPeriodEnd = (subscription as { current_period_end?: unknown }).current_period_end
  const fechaFinPlan = typeof currentPeriodEnd === 'number'
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null

  return { plan, fechaFinPlan }
}

async function marcarDescuentoComoUsado(metadata: Stripe.Metadata | null | undefined) {
  const descuentoId = typeof metadata?.descuento_id === 'string'
    ? metadata.descuento_id.trim()
    : ''
  const codigo = typeof metadata?.codigo_descuento === 'string'
    ? metadata.codigo_descuento.trim().toUpperCase()
    : ''

  if (!descuentoId && !codigo) return

  const supabase = getServiceClient()
  let query = supabase
    .from('descuentos')
    .update({ usado: true })

  query = descuentoId
    ? query.eq('id', descuentoId)
    : query.eq('codigo', codigo)

  const { error } = await query

  if (faltaRelacion(error, 'descuentos')) {
    throw new Error('Falta la tabla descuentos. Ejecuta la migración 018 en Supabase.')
  }

  if (error) {
    throw new Error(`marcarDescuentoComoUsado: ${error.message}`)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Sin firma Stripe' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Firma inválida'
    return NextResponse.json({ error: `Webhook error: ${mensaje}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        if (!session.customer || !session.subscription) break

        const datosSubscription = await obtenerDatosSubscription(session.subscription as string)
        await activarMembresia(
          session.customer as string,
          session.subscription as string,
          datosSubscription.plan,
          datosSubscription.fechaFinPlan
        )
        await marcarDescuentoComoUsado(session.metadata)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceConSubscription = invoice as Stripe.Invoice & { subscription?: string | null }
        const subId = typeof invoiceConSubscription.subscription === 'string'
          ? invoiceConSubscription.subscription
          : (
            typeof invoice.parent === 'object' && invoice.parent?.type === 'subscription_details'
              ? (invoice.parent as { subscription_id?: string }).subscription_id ?? null
              : null
          )
        if (!invoice.customer || !subId) break

        const datosSubscription = await obtenerDatosSubscription(subId)
        await activarMembresia(
          invoice.customer as string,
          subId,
          datosSubscription.plan,
          datosSubscription.fechaFinPlan
        )
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn(`Pago fallido para customer: ${invoice.customer}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (!sub.customer) break
        await desactivarMembresia(sub.customer as string)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        if (!sub.customer) break

        const activo = sub.status === 'active' || sub.status === 'trialing'
        if (!activo) {
          await desactivarMembresia(sub.customer as string)
          break
        }

        let plan = planDesdePriceId(sub.items.data[0]?.price?.id)
        const currentPeriodEnd = (sub as { current_period_end?: unknown }).current_period_end
        let fechaFinPlan = typeof currentPeriodEnd === 'number'
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null

        if (!plan) {
          const datosSubscription = await obtenerDatosSubscription(sub.id)
          plan = datosSubscription.plan
          if (!fechaFinPlan) {
            fechaFinPlan = datosSubscription.fechaFinPlan
          }
        }

        await activarMembresia(
          sub.customer as string,
          sub.id,
          plan,
          fechaFinPlan
        )
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Error procesando webhook:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ recibido: true })
}
