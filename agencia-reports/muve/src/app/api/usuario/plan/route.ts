import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import {
  PLAN_MAX_VISITAS_POR_LUGAR,
  PLAN_VISITAS_MENSUALES,
  normalizarPlan,
  planDesdePriceId,
} from '@/lib/planes'
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

async function contarVisitasMesActual(userId: string): Promise<number> {
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('fecha', inicioMes.toISOString())

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      plan_activo: false,
      plan: null,
      limite_visitas_mensuales: 0,
      max_visitas_por_lugar: 0,
      visitas_usadas_mes: 0,
      visitas_restantes_mes: 0,
    })
  }

  try {
    const perfil = await obtenerPerfilPlan(user.id)
    const planActivo = Boolean(perfil.plan_activo)
    let plan = normalizarPlan(perfil.plan ?? null)
    if (planActivo && !plan) {
      try {
        const stripeSubscriptionId = await obtenerStripeSubscriptionId(user.id)
        if (!stripeSubscriptionId) {
          return NextResponse.json({
            plan_activo: planActivo,
            plan: null,
            limite_visitas_mensuales: 0,
            max_visitas_por_lugar: 0,
            visitas_usadas_mes: 0,
            visitas_restantes_mes: 0,
          })
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

    const limiteVisitasMensuales = planActivo && plan
      ? PLAN_VISITAS_MENSUALES[plan]
      : 0
    const maxVisitasPorLugar = planActivo && plan
      ? PLAN_MAX_VISITAS_POR_LUGAR[plan]
      : 0

    let visitasUsadasMes = 0
    if (planActivo && plan) {
      try {
        visitasUsadasMes = await contarVisitasMesActual(user.id)
      } catch (error) {
        console.error('[GET /api/usuario/plan] error contando visitas del mes:', error)
      }
    }

    const visitasRestantesMes = Math.max(limiteVisitasMensuales - visitasUsadasMes, 0)

    return NextResponse.json({
      plan_activo: planActivo,
      plan,
      limite_visitas_mensuales: limiteVisitasMensuales,
      max_visitas_por_lugar: maxVisitasPorLugar,
      visitas_usadas_mes: visitasUsadasMes,
      visitas_restantes_mes: visitasRestantesMes,
    })
  } catch (error) {
    console.error('[GET /api/usuario/plan]', error)
    return NextResponse.json({ error: 'No se pudo resolver el plan del usuario' }, { status: 500 })
  }
}
