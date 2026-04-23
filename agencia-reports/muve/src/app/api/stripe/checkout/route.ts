import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const priceId: string = body.priceId ?? process.env.STRIPE_PRICE_ID_MENSUAL ?? ''

  if (!priceId.startsWith('price_')) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const { data: perfil } = await supabase
    .from('users')
    .select('nombre, email, stripe_customer_id, plan_activo')
    .eq('id', user.id)
    .single()

  if (perfil?.plan_activo) {
    return NextResponse.json({ error: 'Ya tienes una membresía activa' }, { status: 400 })
  }

  let customerId = perfil?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: perfil?.email ?? user.email!,
      name: perfil?.nombre,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?membresia=activada`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/?pago=cancelado`,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
