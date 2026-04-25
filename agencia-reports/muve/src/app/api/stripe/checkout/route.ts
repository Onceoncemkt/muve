import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { planDesdePriceId } from '@/lib/planes'
import type { PlanMembresia } from '@/types'

const PRICE_IDS_CENTRO: Record<PlanMembresia, string> = {
  basico: process.env.STRIPE_PRICE_ID_BASICO ?? 'price_1TPWhLRzNt1SyOBv8EYKsGGP',
  plus: process.env.STRIPE_PRICE_ID_PLUS ?? 'price_1TPS4eRzNt1SyOBv47steWqz',
  total: process.env.STRIPE_PRICE_ID_TOTAL ?? 'price_1TPWhgRzNt1SyOBvrA0F50v1',
}

const PRICE_IDS_BC: Record<PlanMembresia, string> = {
  basico: process.env.STRIPE_PRICE_ID_BASICO_BC ?? 'price_1TPwv9RzNt1SyOBvJZIhqZKT',
  plus: process.env.STRIPE_PRICE_ID_PLUS_BC ?? 'price_1TPwxRRzNt1SyOBvIxIRS4sM',
  total: process.env.STRIPE_PRICE_ID_TOTAL_BC ?? 'price_1TPwyuRzNt1SyOBv5lQXhhLS',
}

function esCiudadBC(ciudad: string | null | undefined) {
  return ciudad === 'tijuana' || ciudad === 'ensenada'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const priceIdSolicitado: string = body.priceId ?? ''
  const planSolicitado = planDesdePriceId(priceIdSolicitado)

  if (!planSolicitado) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const { data: perfil } = await supabase
    .from('users')
    .select('nombre, email, stripe_customer_id, plan_activo, ciudad')
    .eq('id', user.id)
    .single()

  if (perfil?.plan_activo) {
    return NextResponse.json({ error: 'Ya tienes una membresía activa' }, { status: 400 })
  }

  const priceIdsCiudad = esCiudadBC(perfil?.ciudad) ? PRICE_IDS_BC : PRICE_IDS_CENTRO
  const priceIdFinal = priceIdsCiudad[planSolicitado]
  if (!priceIdFinal) {
    return NextResponse.json({ error: 'Configuración de precios incompleta' }, { status: 500 })
  }

  let customerId = perfil?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: perfil?.email ?? user.email!,
      name: perfil?.nombre ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // Derivar la URL base del request para que funcione en cualquier entorno
  // (dev, preview, producción) sin depender de NEXT_PUBLIC_URL
  const origin = new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceIdFinal, quantity: 1 }],
    success_url: `${origin}/dashboard?membresia=activada`,
    cancel_url: `${origin}/`,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
