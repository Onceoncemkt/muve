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
  nombre: string
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
  const modo = searchParams.get('modo')
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
    .select('id, nombre, stripe_account_id')
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
      'No se encontró el negocio para conectar Stripe.'
    )
  }

  const negocio = consultaNegocio.data

  if (modo === 'gestionar') {
    if (!negocio.stripe_account_id) {
      return redireccionDashboard(
        request,
        'error',
        'Primero conecta tu cuenta Stripe para gestionar pagos.'
      )
    }

    try {
      const loginLink = await stripe.accounts.createLoginLink(negocio.stripe_account_id)

      return NextResponse.redirect(loginLink.url, 303)
    } catch (error) {
      const errorMessage = mensajeErrorStripe(error)
      console.error('[GET /api/negocio/stripe-connect] createLoginLink error:', errorMessage)
      return redireccionDashboard(
        request,
        'error',
        'No se pudo abrir tu cuenta Stripe Express. Intenta de nuevo.'
      )
    }
  }

  try {
    let stripeAccountId = negocio.stripe_account_id

    if (!stripeAccountId) {
      const cuentaStripe = await stripe.accounts.create({
        type: 'express',
        country: 'MX',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          negocio_id: negocio.id,
          negocio_nombre: negocio.nombre,
        },
      })

      stripeAccountId = cuentaStripe.id

      const { error: updateError } = await db
        .from('negocios')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', negocio.id)

      if (updateError) {
        console.error('[GET /api/negocio/stripe-connect] update stripe_account_id error:', updateError.message)
        return redireccionDashboard(
          request,
          'error',
          'Se creó la cuenta Stripe pero no se pudo guardar en tu negocio.'
        )
      }
    }

    if (!stripeAccountId) {
      return redireccionDashboard(
        request,
        'error',
        'No se pudo obtener la cuenta Stripe del negocio.'
      )
    }

    const refreshUrl = new URL('/api/negocio/stripe-connect', request.url)
    if (perfil.rol === 'admin') {
      refreshUrl.searchParams.set('negocio_id', negocio.id)
    }

    const returnUrl = new URL('/api/negocio/stripe-connect/return', request.url)
    if (perfil.rol === 'admin') {
      returnUrl.searchParams.set('negocio_id', negocio.id)
    }

    const onboardingLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: 'account_onboarding',
    })

    return NextResponse.redirect(onboardingLink.url, 303)
  } catch (error) {
    const errorMessage = mensajeErrorStripe(error)
    console.error('[GET /api/negocio/stripe-connect] stripe error:', errorMessage)
    return redireccionDashboard(
      request,
      'error',
      'No se pudo iniciar el onboarding de Stripe. Revisa tu configuración e intenta de nuevo.'
    )
  }
}
