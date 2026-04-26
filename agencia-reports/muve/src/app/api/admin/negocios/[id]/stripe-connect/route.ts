import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import type { Rol } from '@/types'

type NegocioStripe = {
  id: string
  nombre: string
  stripe_account_id: string | null
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function resolverNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/admin'
  return value.startsWith('/admin') ? value : '/admin'
}

function redireccionConEstado(
  request: NextRequest,
  nextPath: string,
  estado: 'ok' | 'error',
  mensaje: string
) {
  const url = new URL(nextPath, request.url)
  url.searchParams.set('negocio_status', estado)
  url.searchParams.set('negocio_msg', mensaje)
  return NextResponse.redirect(url, 303)
}

function faltaColumnaStripeAccountId(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('stripe_account_id')
}

function mensajeErrorStripe(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Error desconocido con Stripe'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  const formData = await request.formData()
  const nextPath = resolverNextPath(formData.get('next'))

  const { data: negocio, error: negocioError } = await db
    .from('negocios')
    .select('id, nombre, stripe_account_id')
    .eq('id', id)
    .maybeSingle<NegocioStripe>()

  if (faltaColumnaStripeAccountId(negocioError)) {
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'Falta la columna stripe_account_id en negocios. Ejecuta la migración 016 en Supabase.'
    )
  }

  if (negocioError || !negocio) {
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'No se encontró el negocio para conectar Stripe.'
    )
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
        console.error('[POST /api/admin/negocios/[id]/stripe-connect] update stripe_account_id error:', updateError.message)
        return redireccionConEstado(
          request,
          nextPath,
          'error',
          'Se creó la cuenta Stripe pero no se pudo guardar en el negocio.'
        )
      }
    }

    if (!stripeAccountId) {
      return redireccionConEstado(
        request,
        nextPath,
        'error',
        'No se pudo obtener la cuenta Stripe del negocio.'
      )
    }

    const refreshUrl = new URL(nextPath, request.url)
    refreshUrl.searchParams.set('negocio_status', 'error')
    refreshUrl.searchParams.set('negocio_msg', 'Onboarding de Stripe incompleto. Intenta de nuevo.')

    const returnUrl = new URL(nextPath, request.url)
    returnUrl.searchParams.set('negocio_status', 'ok')
    returnUrl.searchParams.set('negocio_msg', 'Cuenta Stripe enlazada. Completa el onboarding para recibir pagos.')

    const onboardingLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: 'account_onboarding',
    })

    return NextResponse.redirect(onboardingLink.url, 303)
  } catch (error) {
    const errorMessage = mensajeErrorStripe(error)
    console.error('[POST /api/admin/negocios/[id]/stripe-connect] stripe error:', errorMessage)
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'No se pudo iniciar el onboarding de Stripe. Revisa tu configuración de Stripe Connect.'
    )
  }
}
