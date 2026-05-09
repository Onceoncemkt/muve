import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { planDesdePriceId } from '@/lib/planes'
import type { PlanMembresia } from '@/types'
import { sumarUnMes } from '@/lib/ciclos'
export const runtime = 'nodejs'

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

function columnaFechaInicioCicloNoExiste(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('fecha_inicio_ciclo')
}

function faltaRelacion(error: { message?: string } | null | undefined, relation: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
}

async function activarMembresia(
  customerId: string,
  subscriptionId: string,
  plan: PlanMembresia
) {
  const supabase = getServiceClient()
  const inicioCiclo = new Date()
  const fechaInicioCiclo = inicioCiclo.toISOString()
  const fechaFinPlan = sumarUnMes(inicioCiclo).toISOString()
  let { data, error } = await supabase
    .from('users')
    .update({
      plan_activo: true,
      stripe_subscription_id: subscriptionId,
      plan,
      fecha_inicio_ciclo: fechaInicioCiclo,
      fecha_fin_plan: fechaFinPlan,
    })
    .eq('stripe_customer_id', customerId)
    .select()

  if (error) {
    console.error('[activarMembresia] Supabase update error:', { customerId, plan, error })
  } else if (!data || data.length === 0) {
    console.error('[activarMembresia] No rows updated for customer:', customerId)
  } else {
    console.log('[activarMembresia] Success:', { customerId, plan, rows: data.length })
  }

  if (
    columnaPlanNoExiste(error)
    || columnaFechaInicioCicloNoExiste(error)
    || columnaFechaFinPlanNoExiste(error)
  ) {
    const fallbackPayload: Record<string, unknown> = {
      plan_activo: true,
      stripe_subscription_id: subscriptionId,
    }
    if (!columnaPlanNoExiste(error)) {
      fallbackPayload.plan = plan
    }
    if (!columnaFechaInicioCicloNoExiste(error)) {
      fallbackPayload.fecha_inicio_ciclo = fechaInicioCiclo
    }
    if (!columnaFechaFinPlanNoExiste(error)) {
      fallbackPayload.fecha_fin_plan = fechaFinPlan
    }

    const fallback = await supabase
      .from('users')
      .update(fallbackPayload)
      .eq('stripe_customer_id', customerId)
      .select()
    data = fallback.data
    error = fallback.error

    if (error) {
      console.error('[activarMembresia] Supabase update error (fallback):', { customerId, plan, error })
    } else if (!data || data.length === 0) {
      console.error('[activarMembresia] No rows updated for customer (fallback):', customerId)
    } else {
      console.log('[activarMembresia] Success (fallback):', { customerId, plan, rows: data.length })
    }
  }

  if (error) throw new Error(`activarMembresia: ${error.message}`)
}

async function desactivarMembresia(customerId: string) {
  const supabase = getServiceClient()
  let { data, error } = await supabase
    .from('users')
    .update({
      plan_activo: false,
      stripe_subscription_id: null,
      plan: null,
      fecha_inicio_ciclo: null,
      fecha_fin_plan: null,
    })
    .eq('stripe_customer_id', customerId)
    .select()

  if (error) {
    console.error('[desactivarMembresia] Supabase update error:', { customerId, plan: null, error })
  } else if (!data || data.length === 0) {
    console.error('[desactivarMembresia] No rows updated for customer:', customerId)
  } else {
    console.log('[desactivarMembresia] Success:', { customerId, plan: null, rows: data.length })
  }

  if (
    columnaPlanNoExiste(error)
    || columnaFechaInicioCicloNoExiste(error)
    || columnaFechaFinPlanNoExiste(error)
  ) {
    const fallbackPayload: Record<string, unknown> = {
      plan_activo: false,
      stripe_subscription_id: null,
    }
    if (!columnaPlanNoExiste(error)) {
      fallbackPayload.plan = null
    }
    if (!columnaFechaInicioCicloNoExiste(error)) {
      fallbackPayload.fecha_inicio_ciclo = null
    }
    if (!columnaFechaFinPlanNoExiste(error)) {
      fallbackPayload.fecha_fin_plan = null
    }

    const fallback = await supabase
      .from('users')
      .update(fallbackPayload)
      .eq('stripe_customer_id', customerId)
      .select()
    data = fallback.data
    error = fallback.error

    if (error) {
      console.error('[desactivarMembresia] Supabase update error (fallback):', { customerId, plan: null, error })
    } else if (!data || data.length === 0) {
      console.error('[desactivarMembresia] No rows updated for customer (fallback):', customerId)
    } else {
      console.log('[desactivarMembresia] Success (fallback):', { customerId, plan: null, rows: data.length })
    }
  }

  if (error) throw new Error(`desactivarMembresia: ${error.message}`)
}

async function obtenerPlanDesdeSubscription(subscriptionId: string): Promise<PlanMembresia> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price?.id
  const plan = planDesdePriceId(priceId)
  if (!plan) {
    throw new Error(`price_id no mapeado para membresía: ${priceId ?? 'desconocido'}`)
  }
  return plan
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
async function obtenerPlanActualUsuario(customerId: string): Promise<PlanMembresia | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('plan')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) {
    console.error('[stripe-webhook] Error leyendo plan actual de usuario', { customerId, error })
    return null
  }

  const plan = typeof data?.plan === 'string' ? data.plan : null
  if (plan === 'basico' || plan === 'plus' || plan === 'total') return plan
  return null
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const bodyPrimerCaracter = body.length > 0 ? body[0] : '(vacío)'
  const bodyUltimoCaracter = body.length > 0 ? body[body.length - 1] : '(vacío)'
  const firmaPreview = sig ? sig.slice(0, 50) : '(missing)'
  const secretPreview = webhookSecret ? webhookSecret.slice(0, 10) : '(missing)'

  console.log('[stripe-webhook] body info', {
    primerCaracter: bodyPrimerCaracter,
    ultimoCaracter: bodyUltimoCaracter,
    longitud: body.length,
  })
  console.log('[stripe-webhook] stripe-signature preview', firmaPreview)
  console.log('[stripe-webhook] secret info', {
    existe: Boolean(webhookSecret),
    preview: secretPreview,
  })

  if (!sig) {
    return NextResponse.json({ error: 'Sin firma Stripe' }, { status: 400 })
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Falta STRIPE_WEBHOOK_SECRET' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Firma inválida'
    return NextResponse.json({ error: `Webhook error: ${mensaje}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = typeof session.customer === 'string' ? session.customer : null
        const subscriptionId = (
          (typeof session.subscription === 'string' ? session.subscription : null)
          || (session as Stripe.Checkout.Session & {
            parent?: { subscription_details?: { subscription?: string | null } }
          }).parent?.subscription_details?.subscription
          || null
        ) as string | null
        if (session.mode !== 'subscription') {
          console.error('[stripe-webhook] checkout.session.completed con mode no subscription', session.id)
          break
        }
        if (!customerId) {
          console.error('[stripe-webhook] checkout.session.completed sin customer', session.id)
          break
        }
        if (!subscriptionId) {
          console.error('[stripe-webhook] checkout.session.completed sin subscription', session.id)
          break
        }
        const plan = await obtenerPlanDesdeSubscription(subscriptionId)
        console.log('[stripe-webhook] llamando activarMembresia', {
          customerId,
          subscriptionId,
          plan,
          source: 'checkout.session.completed',
        })
        await activarMembresia(
          customerId,
          subscriptionId,
          plan
        )
        await marcarDescuentoComoUsado(session.metadata)
        break
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
        const subscriptionId = (
          (invoice as Stripe.Invoice & { subscription?: string | null }).subscription
          || (invoice as Stripe.Invoice & {
            parent?: { subscription_details?: { subscription?: string | null } }
          }).parent?.subscription_details?.subscription
          || null
        ) as string | null
        if (!customerId) {
          console.error('[stripe-webhook] invoice.payment_succeeded sin customer', invoice.id)
          break
        }
        if (!subscriptionId) {
          console.error('[stripe-webhook] invoice sin subscription_id', {
            invoiceId: invoice.id,
            customerId,
            parentType: (invoice as Stripe.Invoice & { parent?: { type?: string } }).parent?.type,
            fullParent: (invoice as Stripe.Invoice & { parent?: unknown }).parent,
          })
          break
        }
        const plan = await obtenerPlanDesdeSubscription(subscriptionId)
        console.log('[stripe-webhook] llamando activarMembresia', {
          customerId,
          subscriptionId,
          plan,
          source: 'invoice.payment_succeeded',
        })
        await activarMembresia(
          customerId,
          subscriptionId,
          plan
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
        const customerId = typeof sub.customer === 'string' ? sub.customer : null
        const subscriptionId = sub.id
        console.log('[stripe-webhook] subscription.deleted', { customerId, subscriptionId })
        if (!customerId) {
          console.error('[stripe-webhook] customer.subscription.deleted sin customer', sub.id)
          break
        }
        try {
          await desactivarMembresia(customerId)
        } catch (err) {
          console.error('[stripe-webhook] Error desactivando membresía en subscription.deleted', {
            customerId,
            subscriptionId,
            err,
          })
        }
        break
      }
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        console.log('[stripe-webhook] subscription.created received, no action needed', sub.id)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : null
        const subscriptionId = sub.id
        const status = sub.status
        console.log('[stripe-webhook] subscription.updated', { customerId, subscriptionId, status })
        if (!customerId) {
          console.error('[stripe-webhook] customer.subscription.updated sin customer', sub.id)
          break
        }
        if (status === 'canceled' || status === 'unpaid') {
          try {
            await desactivarMembresia(customerId)
          } catch (err) {
            console.error('[stripe-webhook] Error desactivando membresía en subscription.updated', {
              customerId,
              subscriptionId,
              status,
              err,
            })
          }
          break
        }
        if (status === 'past_due') {
          console.log('[stripe-webhook] subscription.updated past_due, esperando reintentos de cobro', {
            customerId,
            subscriptionId,
          })
          break
        }
        if (status !== 'active' && status !== 'trialing') {
          console.log('[stripe-webhook] subscription.updated status sin acción', {
            customerId,
            subscriptionId,
            status,
          })
          break
        }

        let nuevoPlan = planDesdePriceId(sub.items.data[0]?.price?.id)
        if (!nuevoPlan) {
          nuevoPlan = await obtenerPlanDesdeSubscription(subscriptionId)
        }
        if (!nuevoPlan) {
          console.error('[stripe-webhook] No se pudo resolver plan en subscription.updated', {
            customerId,
            subscriptionId,
            status,
          })
          break
        }

        const planActual = await obtenerPlanActualUsuario(customerId)
        if (planActual === nuevoPlan) {
          console.log('[stripe-webhook] subscription.updated sin cambio de plan', {
            customerId,
            subscriptionId,
            status,
            plan: nuevoPlan,
          })
          break
        }

        console.log('[stripe-webhook] subscription.updated con cambio de plan, sincronizando DB', {
          customerId,
          subscriptionId,
          status,
          planActual,
          nuevoPlan,
        })
        try {
          await activarMembresia(
            customerId,
            subscriptionId,
            nuevoPlan
          )
        } catch (err) {
          console.error('[stripe-webhook] Error activando membresía en subscription.updated', {
            customerId,
            subscriptionId,
            status,
            nuevoPlan,
            err,
          })
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        console.log('[stripe-webhook] charge.refunded', {
          chargeId: charge.id,
          amount: charge.amount_refunded || charge.amount,
          customer: charge.customer,
        })
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
