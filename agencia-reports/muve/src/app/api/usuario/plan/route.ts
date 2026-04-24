import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { normalizarPlan, planDesdePriceId } from '@/lib/planes'
import type { PlanMembresia } from '@/types'
import { createServiceClient } from '@/lib/supabase/service'

type PerfilPlan = {
  plan_activo: boolean | null
  plan?: PlanMembresia | null
}
type PerfilSubscription = {
  stripe_subscription_id: string | null
}


function mensajeColumnaNoExiste(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

async function obtenerPerfilPlan(userId: string): Promise<PerfilPlan> {
  const supabase = createServiceClient()

  const consultaPrincipal = await supabase
    .from('users')
    .select('plan_activo, plan')
    .eq('id', userId)
    .maybeSingle<PerfilPlan>()

  if (!consultaPrincipal.error) {
    return consultaPrincipal.data ?? { plan_activo: false, plan: null }
  }

  const faltaColumnaPlan = mensajeColumnaNoExiste(consultaPrincipal.error, 'plan')
  if (!faltaColumnaPlan) {
    throw new Error(consultaPrincipal.error.message)
  }

  const fallback = await supabase
    .from('users')
    .select('plan_activo')
    .eq('id', userId)
    .maybeSingle<{ plan_activo: boolean | null }>()

  if (fallback.error) {
    throw new Error(fallback.error.message)
  }

  return {
    plan_activo: fallback.data?.plan_activo ?? false,
    plan: null,
  }
}

async function obtenerStripeSubscriptionId(userId: string): Promise<string | null> {
  const supabase = createServiceClient()

  const consulta = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle<PerfilSubscription>()

  if (!consulta.error) {
    return consulta.data?.stripe_subscription_id ?? null
  }

  if (mensajeColumnaNoExiste(consulta.error, 'stripe_subscription_id')) {
    return null
  }

  throw new Error(consulta.error.message)
}

async function planDesdeStripe(subscriptionId: string): Promise<PlanMembresia | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price?.id
  return planDesdePriceId(priceId)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ plan_activo: false, plan: null })
  }

  try {
    const perfil = await obtenerPerfilPlan(user.id)
    const planActivo = Boolean(perfil.plan_activo)
    let plan = normalizarPlan(perfil.plan ?? null)
    if (planActivo && !plan) {
      try {
        const stripeSubscriptionId = await obtenerStripeSubscriptionId(user.id)
        if (!stripeSubscriptionId) {
          return NextResponse.json({ plan_activo: planActivo, plan: null })
        }

        plan = await planDesdeStripe(stripeSubscriptionId)
        if (plan) {
          const admin = createServiceClient()
          await admin.from('users').update({ plan }).eq('id', user.id)
        }
      } catch (error) {
        console.error('[GET /api/usuario/plan] fallback Stripe error:', error)
      }
    }

    return NextResponse.json({ plan_activo: planActivo, plan })
  } catch (error) {
    console.error('[GET /api/usuario/plan]', error)
    return NextResponse.json({ error: 'No se pudo resolver el plan del usuario' }, { status: 500 })
  }
}
