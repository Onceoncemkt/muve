import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { calcularVisitasRestantes } from '@/lib/creditos'
import { priceIdDesdePlanYCiudad } from '@/lib/planes'
import { resolverVentanaCiclo } from '@/lib/ciclos'
import { normalizarCiudadOperativa, type Ciudad, type PlanMembresia } from '@/types'

type PerfilRenovar = {
  plan: PlanMembresia | null
  plan_activo: boolean | null
  ciudad: Ciudad | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  creditos_extra: number | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const admin = createServiceClient()
    const { data: perfil, error: perfilError } = await admin
      .from('users')
      .select('plan, plan_activo, ciudad, stripe_customer_id, stripe_subscription_id, creditos_extra, fecha_inicio_ciclo, fecha_fin_plan')
      .eq('id', user.id)
      .maybeSingle<PerfilRenovar>()

    if (perfilError || !perfil) {
      console.error('[renovar] error obteniendo perfil de usuario', { userId: user.id, perfilError })
      return NextResponse.json({ error: 'No se pudo iniciar la renovación' }, { status: 500 })
    }

    const planActivo = perfil.plan_activo === true
    if (!planActivo) {
      return NextResponse.json({ error: 'No tienes un plan activo para renovar' }, { status: 400 })
    }
    if (!perfil.stripe_customer_id) {
      return NextResponse.json({ error: 'Tu cuenta no tiene customer en Stripe. Contacta soporte.' }, { status: 400 })
    }
    if (!perfil.stripe_subscription_id) {
      return NextResponse.json({ error: 'Tu cuenta no tiene suscripción en Stripe. Contacta soporte.' }, { status: 400 })
    }
    if (!perfil.plan) {
      return NextResponse.json({ error: 'Plan inválido. Contacta soporte.' }, { status: 400 })
    }

    const ciclo = resolverVentanaCiclo({
      fechaInicioCiclo: perfil.fecha_inicio_ciclo,
      fechaFinPlan: perfil.fecha_fin_plan,
    })
    const visitasUsadasCiclo = await contarVisitasCiclo(
      user.id,
      ciclo.inicio.toISOString(),
      ciclo.fin.toISOString()
    )
    const creditosExtra = Math.max(Math.trunc(perfil.creditos_extra ?? 0), 0)
    const visitasRestantes = calcularVisitasRestantes({
      plan: perfil.plan,
      creditosExtra,
      visitasUsadasCiclo,
    })

    if (visitasRestantes > 0) {
      return NextResponse.json({ error: 'Aún tienes créditos disponibles este ciclo' }, { status: 400 })
    }

    try {
      await stripe.subscriptions.cancel(perfil.stripe_subscription_id, { prorate: false })
      console.log('[renovar] suscripción cancelada', { userId: user.id, subId: perfil.stripe_subscription_id })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'error desconocido'
      console.warn('[renovar] subscription.cancel error (puede ser que ya estuviera cancelada):', message)
    }

    const ciudad = normalizarCiudadOperativa(perfil.ciudad)
    if (!ciudad) {
      return NextResponse.json({ error: 'Error mapeando plan a priceId' }, { status: 500 })
    }
    const priceId = priceIdDesdePlanYCiudad(perfil.plan, ciudad)
    if (!priceId) {
      return NextResponse.json({ error: 'Error mapeando plan a priceId' }, { status: 500 })
    }

    const origin = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      customer: perfil.stripe_customer_id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?renovado=true`,
      cancel_url: `${origin}/dashboard?renovacion_cancelada=true`,
      metadata: {
        supabase_user_id: user.id,
        renovacion: 'true',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    })

    console.log('[renovar] checkout session creada', {
      userId: user.id,
      plan: perfil.plan,
      priceId,
      sessionId: session.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[renovar] error global:', error)
    return NextResponse.json({ error: 'No se pudo iniciar la renovación' }, { status: 500 })
  }
}
