import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import {
  mensajeErrorStripe,
  obtenerPerfilAcceso,
  resolverNegocioParaStripe,
} from '@/lib/stripe-connect'

function redireccion(request: NextRequest, estado: 'ok' | 'error', mensaje: string) {
  const url = new URL('/negocio/perfil', request.url)
  url.searchParams.set('stripe_status', estado)
  url.searchParams.set('stripe_msg', mensaje)
  return NextResponse.redirect(url, 303)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioResult = await resolverNegocioParaStripe(perfil, searchParams.get('negocio_id'))
  if (!negocioResult.ok) {
    return redireccion(request, 'error', negocioResult.error)
  }

  const stripeAccountId = negocioResult.negocio.stripe_account_id
  if (!stripeAccountId) {
    return redireccion(request, 'error', 'Primero conecta tu cuenta Stripe.')
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId)
    return NextResponse.redirect(loginLink.url, 303)
  } catch (error) {
    console.error('[GET /api/stripe/connect/dashboard] createLoginLink error:', mensajeErrorStripe(error))
    return redireccion(request, 'error', 'No se pudo abrir tu cuenta Stripe Express. Intenta de nuevo.')
  }
}
