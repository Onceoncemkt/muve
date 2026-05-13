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

type ResolverNegocioResult =
  | { ok: true; negocio: NegocioStripe }
  | { ok: false; error: string; status: number }

async function resolverNegocio(request: NextRequest, perfil: PerfilAcceso): Promise<ResolverNegocioResult> {
  const { searchParams } = new URL(request.url)
  const negocioIdParam = searchParams.get('negocio_id')
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdParam ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return { ok: false, error: 'Tu cuenta no tiene un negocio asignado para conectar Stripe.', status: 400 }
  }

  const db = createServiceClient()
  const consultaNegocio = await db
    .from('negocios')
    .select('id, nombre, stripe_account_id')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<NegocioStripe>()

  if (faltaColumna(consultaNegocio.error, 'stripe_account_id')) {
    return {
      ok: false,
      error: 'Falta la columna stripe_account_id en negocios. Ejecuta la migración 016 en Supabase.',
      status: 500,
    }
  }

  if (consultaNegocio.error || !consultaNegocio.data) {
    return { ok: false, error: 'No se encontró el negocio para conectar Stripe.', status: 404 }
  }

  return { ok: true, negocio: consultaNegocio.data }
}

type GenerarAccountLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number }

async function generarAccountLink(
  request: NextRequest,
  negocio: NegocioStripe,
  rol: Rol
): Promise<GenerarAccountLinkResult> {
  const db = createServiceClient()

  try {
    let stripeAccountId = negocio.stripe_account_id

    if (!stripeAccountId) {
      const cuentaStripe = await stripe.accounts.create({
        type: 'express',
        country: 'MX',
        default_currency: 'mxn',
        capabilities: {
          card_payments: { requested: true },
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
        console.error('[stripe-connect] update stripe_account_id error:', updateError.message)
        return {
          ok: false,
          error: 'Se creó la cuenta Stripe pero no se pudo guardar en tu negocio.',
          status: 500,
        }
      }
    }

    const refreshUrl = new URL('/negocio/perfil', request.url)
    refreshUrl.searchParams.set('stripe', 'refresh')
    if (rol === 'admin') refreshUrl.searchParams.set('negocio_id', negocio.id)

    const returnUrl = new URL('/negocio/perfil', request.url)
    returnUrl.searchParams.set('stripe', 'success')
    if (rol === 'admin') returnUrl.searchParams.set('negocio_id', negocio.id)

    const onboardingLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: 'account_onboarding',
    })

    return { ok: true, url: onboardingLink.url }
  } catch (error) {
    const errorMessage = mensajeErrorStripe(error)
    console.error('[stripe-connect] stripe error:', errorMessage)
    return {
      ok: false,
      error: 'No se pudo iniciar el onboarding de Stripe. Revisa tu configuración e intenta de nuevo.',
      status: 500,
    }
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const negocioResult = await resolverNegocio(request, perfil)
  if (!negocioResult.ok) {
    return NextResponse.json({ error: negocioResult.error }, { status: negocioResult.status })
  }

  const linkResult = await generarAccountLink(request, negocioResult.negocio, perfil.rol)
  if (!linkResult.ok) {
    return NextResponse.json({ error: linkResult.error }, { status: linkResult.status })
  }

  return NextResponse.json({ url: linkResult.url })
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
  const modo = searchParams.get('modo')

  const negocioResult = await resolverNegocio(request, perfil)
  if (!negocioResult.ok) {
    return redireccionDashboard(request, 'error', negocioResult.error)
  }

  const negocio = negocioResult.negocio

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

  const linkResult = await generarAccountLink(request, negocio, perfil.rol)
  if (!linkResult.ok) {
    return redireccionDashboard(request, 'error', linkResult.error)
  }

  return NextResponse.redirect(linkResult.url, 303)
}
