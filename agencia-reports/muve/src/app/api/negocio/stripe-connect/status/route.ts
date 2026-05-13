import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import type { Rol } from '@/types'

type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

type NegocioStripe = {
  id: string
  stripe_account_id: string | null
}

export type StripeConnectStatus = 'no_account' | 'pending' | 'active'

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

async function obtenerPerfilAcceso(userId: string): Promise<PerfilAcceso | null> {
  const db = createServiceClient()
  const consulta = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', userId)
    .maybeSingle<PerfilAcceso>()

  if (!consulta.error && consulta.data) {
    return {
      rol: consulta.data.rol,
      negocio_id: typeof consulta.data.negocio_id === 'string' ? consulta.data.negocio_id : null,
    }
  }

  if (!faltaColumna(consulta.error, 'negocio_id')) {
    return null
  }

  const fallback = await db
    .from('users')
    .select('rol')
    .eq('id', userId)
    .maybeSingle<{ rol: Rol }>()

  if (fallback.error || !fallback.data) return null

  return {
    rol: fallback.data.rol,
    negocio_id: null,
  }
}

function cuentaActiva(account: {
  details_submitted: boolean
  payouts_enabled: boolean
  charges_enabled?: boolean
  capabilities?: { transfers?: string | null; card_payments?: string | null }
}) {
  return Boolean(
    account.details_submitted
    && account.payouts_enabled
    && account.capabilities?.transfers === 'active'
  )
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
  const negocioIdParam = searchParams.get('negocio_id')
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdParam ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json({ status: 'no_account' satisfies StripeConnectStatus })
  }

  const db = createServiceClient()
  const consultaNegocio = await db
    .from('negocios')
    .select('id, stripe_account_id')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<NegocioStripe>()

  if (faltaColumna(consultaNegocio.error, 'stripe_account_id')) {
    return NextResponse.json({
      error: 'Falta la columna stripe_account_id en negocios.',
    }, { status: 500 })
  }

  if (consultaNegocio.error || !consultaNegocio.data) {
    return NextResponse.json({ status: 'no_account' satisfies StripeConnectStatus })
  }

  const stripeAccountId = consultaNegocio.data.stripe_account_id
  if (!stripeAccountId) {
    return NextResponse.json({ status: 'no_account' satisfies StripeConnectStatus })
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    const activa = cuentaActiva({
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      capabilities: {
        transfers: account.capabilities?.transfers ?? null,
        card_payments: account.capabilities?.card_payments ?? null,
      },
    })

    return NextResponse.json({
      status: (activa ? 'active' : 'pending') satisfies StripeConnectStatus,
    })
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message)
      : 'Error desconocido con Stripe'
    console.error('[GET /api/negocio/stripe-connect/status] stripe error:', message)
    return NextResponse.json({
      status: 'pending' satisfies StripeConnectStatus,
    })
  }
}
