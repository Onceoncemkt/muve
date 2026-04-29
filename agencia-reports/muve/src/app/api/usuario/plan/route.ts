import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import {
  CREDITOS_POR_PLAN,
  MAX_VISITAS_POR_LUGAR,
  normalizarPlan,
  planDesdePriceId,
} from '@/lib/planes'
import type { PlanMembresia } from '@/types'
import { createServiceClient } from '@/lib/supabase/service'
import { planExpirado, resolverVentanaCiclo } from '@/lib/ciclos'

type PerfilPlan = {
  plan_activo: boolean | null
  plan?: PlanMembresia | null
  fecha_inicio_ciclo?: string | null
  fecha_fin_plan?: string | null
  creditos_extra?: number | null
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
    .select('plan_activo, plan, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra')
    .eq('id', userId)
    .maybeSingle<PerfilPlan>()

  if (!consultaPrincipal.error) {
    return consultaPrincipal.data ?? {
      plan_activo: false,
      plan: null,
      fecha_inicio_ciclo: null,
      fecha_fin_plan: null,
      creditos_extra: 0,
    }
  }

  if (mensajeColumnaNoExiste(consultaPrincipal.error, 'fecha_inicio_ciclo')) {
    throw new Error('Falta la columna users.fecha_inicio_ciclo. Ejecuta la migración 019 en Supabase.')
  }

  const faltaColumnaPlan = mensajeColumnaNoExiste(consultaPrincipal.error, 'plan')
  if (!faltaColumnaPlan) {
    throw new Error(consultaPrincipal.error.message)
  }

  const fallback = await supabase
    .from('users')
    .select('plan_activo, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra')
    .eq('id', userId)
    .maybeSingle<{
      plan_activo: boolean | null
      fecha_inicio_ciclo: string | null
      fecha_fin_plan: string | null
      creditos_extra: number | null
    }>()

  if (mensajeColumnaNoExiste(fallback.error, 'fecha_inicio_ciclo')) {
    throw new Error('Falta la columna users.fecha_inicio_ciclo. Ejecuta la migración 019 en Supabase.')
  }

  if (fallback.error) {
    throw new Error(fallback.error.message)
  }

  return {
    plan_activo: fallback.data?.plan_activo ?? false,
    plan: null,
    fecha_inicio_ciclo: fallback.data?.fecha_inicio_ciclo ?? null,
    fecha_fin_plan: fallback.data?.fecha_fin_plan ?? null,
    creditos_extra: Math.max(Math.trunc(fallback.data?.creditos_extra ?? 0), 0),
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

async function contarVisitasCiclo(userId: string, inicioCicloIso: string, finCicloIso: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('fecha', inicioCicloIso)
    .lt('fecha', finCicloIso)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function desactivarPlanSiExpirado(userId: string, perfil: PerfilPlan): Promise<PerfilPlan> {
  const activo = Boolean(perfil.plan_activo)
  if (!activo) return perfil
  if (!planExpirado(perfil.fecha_fin_plan ?? null)) return perfil

  const admin = createServiceClient()
  const { error } = await admin
    .from('users')
    .update({ plan_activo: false })
    .eq('id', userId)

  if (error) {
    console.error('[GET /api/usuario/plan] error desactivando plan expirado:', error)
  }

  return {
    ...perfil,
    plan_activo: false,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      plan_activo: false,
      plan: null,
      fecha_inicio_ciclo: null,
      fecha_fin_ciclo: null,
      limite_creditos_ciclo: 0,
      max_creditos_por_lugar: 0,
      creditos_usados_ciclo: 0,
      creditos_restantes_ciclo: 0,
      creditos_disponibles: 0,
      limite_visitas_mensuales: 0,
      max_visitas_por_lugar: 0,
      visitas_usadas_mes: 0,
      visitas_restantes_mes: 0,
      visitas_usadas_ciclo: 0,
      visitas_restantes_ciclo: 0,
    })
  }

  try {
    let perfil = await obtenerPerfilPlan(user.id)
    perfil = await desactivarPlanSiExpirado(user.id, perfil)

    let plan = normalizarPlan(perfil.plan ?? null)
    let planActivo = Boolean(perfil.plan_activo)
    if (!planActivo && Boolean(plan)) {
      planActivo = true
    }

    if (planActivo && !plan) {
      try {
        const stripeSubscriptionId = await obtenerStripeSubscriptionId(user.id)
        if (stripeSubscriptionId) {
          plan = await planDesdeStripe(stripeSubscriptionId)
          if (plan) {
            const admin = createServiceClient()
            await admin.from('users').update({ plan }).eq('id', user.id)
          }
        }
      } catch (error) {
        console.error('[GET /api/usuario/plan] fallback Stripe error:', error)
      }
    }

    if (planActivo && !plan) {
      plan = 'basico'
    }

    const limiteVisitasMensuales = planActivo && plan
      ? CREDITOS_POR_PLAN[plan]
      : 0
    const maxVisitasPorLugar = planActivo && plan
      ? MAX_VISITAS_POR_LUGAR[plan]
      : 0

    let visitasUsadasCiclo = 0
    const creditosExtra = Math.max(Math.trunc(perfil.creditos_extra ?? 0), 0)
    let fechaInicioCiclo: string | null = null
    let fechaFinCiclo: string | null = null

    if (planActivo && plan) {
      const ciclo = resolverVentanaCiclo({
        fechaInicioCiclo: perfil.fecha_inicio_ciclo,
        fechaFinPlan: perfil.fecha_fin_plan,
      })
      fechaInicioCiclo = ciclo.inicio.toISOString()
      fechaFinCiclo = ciclo.fin.toISOString()

      if (!perfil.fecha_inicio_ciclo || !perfil.fecha_fin_plan) {
        const actualizacionCiclo: Record<string, string> = {}
        if (!perfil.fecha_inicio_ciclo) {
          actualizacionCiclo.fecha_inicio_ciclo = fechaInicioCiclo
        }
        if (!perfil.fecha_fin_plan) {
          actualizacionCiclo.fecha_fin_plan = fechaFinCiclo
        }
        if (Object.keys(actualizacionCiclo).length > 0) {
          const admin = createServiceClient()
          await admin
            .from('users')
            .update(actualizacionCiclo)
            .eq('id', user.id)
        }
      }

      try {
        visitasUsadasCiclo = await contarVisitasCiclo(user.id, fechaInicioCiclo, fechaFinCiclo)
      } catch (error) {
        console.error('[GET /api/usuario/plan] error contando visitas del ciclo:', error)
      }
    }

    const visitasDisponibles = limiteVisitasMensuales + creditosExtra
    const visitasRestantesCiclo = Math.max(visitasDisponibles - visitasUsadasCiclo, 0)

    return NextResponse.json({
      plan_activo: planActivo,
      plan,
      creditos_extra: creditosExtra,
      fecha_inicio_ciclo: fechaInicioCiclo,
      fecha_fin_ciclo: fechaFinCiclo,
      limite_creditos_ciclo: limiteVisitasMensuales,
      max_creditos_por_lugar: maxVisitasPorLugar,
      creditos_disponibles: visitasDisponibles,
      creditos_usados_ciclo: visitasUsadasCiclo,
      creditos_usados: visitasUsadasCiclo,
      creditos_restantes_ciclo: visitasRestantesCiclo,
      limite_visitas_mensuales: limiteVisitasMensuales,
      visitas_disponibles: visitasDisponibles,
      max_visitas_por_lugar: maxVisitasPorLugar,
      visitas_usadas_mes: visitasUsadasCiclo,
      visitas_restantes_mes: visitasRestantesCiclo,
      visitas_usadas_ciclo: visitasUsadasCiclo,
      visitas_restantes_ciclo: visitasRestantesCiclo,
      ciclo_nuevo_el: fechaFinCiclo,
    })
  } catch (error) {
    console.error('[GET /api/usuario/plan]', error)
    return NextResponse.json({ error: 'No se pudo resolver el plan del usuario' }, { status: 500 })
  }
}
