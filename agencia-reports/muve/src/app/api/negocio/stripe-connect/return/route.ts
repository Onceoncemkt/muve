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

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function mensajeErrorStripe(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Error desconocido con Stripe'
}

function redireccionDashboard(
  request: NextRequest,
  estado: 'ok' | 'error',
  mensaje: string
) {
  const url = new URL('/negocio/dashboard', request.url)
  url.searchParams.set('stripe_status', estado)
  url.searchParams.set('stripe_msg', mensaje)
  return NextResponse.redirect(url, 303)
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

function cuentaListaParaPagos(account: {
  details_submitted: boolean
  payouts_enabled: boolean
  capabilities?: { transfers?: string | null }
}) {
  const capacidadTransferencias = account.capabilities?.transfers ?? null
  return Boolean(
    account.details_submitted
    && account.payouts_enabled
    && capacidadTransferencias === 'active'
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
    return redireccionDashboard(
      request,
      'error',
      'Tu cuenta no tiene un negocio asignado para conectar Stripe.'
    )
  }

  const db = createServiceClient()
  const consultaNegocio = await db
    .from('negocios')
    .select('id, stripe_account_id')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<NegocioStripe>()

  if (faltaColumna(consultaNegocio.error, 'stripe_account_id')) {
    return redireccionDashboard(
      request,
      'error',
      'Falta la columna stripe_account_id en negocios. Ejecuta la migración 016 en Supabase.'
    )
  }

  if (consultaNegocio.error || !consultaNegocio.data) {
    return redireccionDashboard(
      request,
      'error',
      'No se encontró el negocio para validar Stripe.'
    )
  }

  const stripeAccountId = consultaNegocio.data.stripe_account_id
  if (!stripeAccountId) {
    return redireccionDashboard(
      request,
      'error',
      'No hay cuenta Stripe conectada para este negocio.'
    )
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    const cuentaActiva = cuentaListaParaPagos({
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      capabilities: {
        transfers: account.capabilities?.transfers ?? null,
      },
    })

    if (!cuentaActiva) {
      return redireccionDashboard(
        request,
        'error',
        'Tu cuenta Stripe aún no está lista para recibir pagos. Completa la configuración pendiente.'
      )
    }

    return redireccionDashboard(
      request,
      'ok',
      'Tu cuenta está lista para recibir pagos'
    )
  } catch (error) {
    const errorMessage = mensajeErrorStripe(error)
    console.error('[GET /api/negocio/stripe-connect/return] stripe error:', errorMessage)
    return redireccionDashboard(
      request,
      'error',
      'No se pudo validar tu cuenta Stripe. Intenta de nuevo.'
    )
  }
}
