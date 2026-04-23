import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: perfil } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.stripe_customer_id) {
    return NextResponse.json({ error: 'Sin suscripción activa' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: perfil.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
