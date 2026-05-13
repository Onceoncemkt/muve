import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  obtenerPerfilAcceso,
  obtenerStripeStatus,
  resolverNegocioParaStripe,
  type StripeConnectStatus,
} from '@/lib/stripe-connect'

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
    return NextResponse.json({ status: 'no_account' satisfies StripeConnectStatus })
  }

  const status = await obtenerStripeStatus(negocioResult.negocio.stripe_account_id)
  return NextResponse.json({ status })
}
