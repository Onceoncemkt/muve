import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Service role para saltarse RLS — solo en server, nunca exponer al cliente
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function activarMembresia(customerId: string, subscriptionId: string) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ plan_activo: true, stripe_subscription_id: subscriptionId })
    .eq('stripe_customer_id', customerId)

  if (error) throw new Error(`activarMembresia: ${error.message}`)
}

async function desactivarMembresia(customerId: string) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ plan_activo: false, stripe_subscription_id: null })
    .eq('stripe_customer_id', customerId)

  if (error) throw new Error(`desactivarMembresia: ${error.message}`)
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
        // Solo procesar suscripciones (no pagos únicos)
        if (session.mode !== 'subscription') break
        if (!session.customer || !session.subscription) break

        await activarMembresia(
          session.customer as string,
          session.subscription as string
        )
        break
      }

      case 'invoice.paid': {
        // Renovación mensual — mantener membresía activa
        const invoice = event.data.object as Stripe.Invoice
        const subId = typeof invoice.parent === 'object' && invoice.parent?.type === 'subscription_details'
          ? (invoice.parent as { subscription_id?: string }).subscription_id
          : null
        if (!invoice.customer || !subId) break

        await activarMembresia(invoice.customer as string, subId)
        break
      }

      case 'invoice.payment_failed': {
        // Pago fallido — Stripe reintentará según la config del dashboard
        // No desactivamos aún; dejamos que `customer.subscription.deleted` lo haga
        // si Stripe cancela definitivamente tras los reintentos
        const invoice = event.data.object as Stripe.Invoice
        console.warn(`Pago fallido para customer: ${invoice.customer}`)
        break
      }

      case 'customer.subscription.deleted': {
        // Cancelación definitiva (manual o por reintentos fallidos)
        const sub = event.data.object as Stripe.Subscription
        if (!sub.customer) break

        await desactivarMembresia(sub.customer as string)
        break
      }

      case 'customer.subscription.updated': {
        // Cambio de plan, pausa, etc.
        const sub = event.data.object as Stripe.Subscription
        if (!sub.customer) break

        const activo = sub.status === 'active' || sub.status === 'trialing'
        if (activo) {
          await activarMembresia(sub.customer as string, sub.id)
        } else {
          await desactivarMembresia(sub.customer as string)
        }
        break
      }

      default:
        // Evento no manejado — ignorar silenciosamente
        break
    }
  } catch (err) {
    console.error('Error procesando webhook:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ recibido: true })
}
