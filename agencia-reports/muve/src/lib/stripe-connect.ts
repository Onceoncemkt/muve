import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import type { Rol } from '@/types'

export type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

export type NegocioStripe = {
  id: string
  nombre: string
  stripe_account_id: string | null
}

export type StripeConnectStatus = 'no_account' | 'pending' | 'active'

export function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

export function mensajeErrorStripe(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Error desconocido con Stripe'
}

export async function obtenerPerfilAcceso(userId: string): Promise<PerfilAcceso | null> {
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

export type ResolverNegocioResult =
  | { ok: true; negocio: NegocioStripe }
  | { ok: false; error: string; status: number }

export async function resolverNegocioParaStripe(
  perfil: PerfilAcceso,
  negocioIdParam: string | null
): Promise<ResolverNegocioResult> {
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdParam ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return { ok: false, error: 'Tu cuenta no tiene un negocio asignado para conectar Stripe.', status: 400 }
  }

  const db = createServiceClient()
  const consulta = await db
    .from('negocios')
    .select('id, nombre, stripe_account_id')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<NegocioStripe>()

  if (faltaColumna(consulta.error, 'stripe_account_id')) {
    return {
      ok: false,
      error: 'Falta la columna stripe_account_id en negocios. Ejecuta la migración 016 en Supabase.',
      status: 500,
    }
  }

  if (consulta.error || !consulta.data) {
    return { ok: false, error: 'No se encontró el negocio para conectar Stripe.', status: 404 }
  }

  return { ok: true, negocio: consulta.data }
}

export type AccountLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number }

export async function crearOReutilizarCuentaYAccountLink(
  origin: string,
  negocio: NegocioStripe,
  rol: Rol
): Promise<AccountLinkResult> {
  try {
    let stripeAccountId = negocio.stripe_account_id

    if (!stripeAccountId) {
      const cuenta = await stripe.accounts.create({
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

      stripeAccountId = cuenta.id

      const db = createServiceClient()
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

    const refreshUrl = new URL('/negocio/perfil', origin)
    refreshUrl.searchParams.set('stripe', 'refresh')
    if (rol === 'admin') refreshUrl.searchParams.set('negocio_id', negocio.id)

    const returnUrl = new URL('/negocio/perfil', origin)
    returnUrl.searchParams.set('stripe', 'success')
    if (rol === 'admin') returnUrl.searchParams.set('negocio_id', negocio.id)

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: 'account_onboarding',
    })

    return { ok: true, url: link.url }
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

export async function obtenerStripeStatus(stripeAccountId: string | null): Promise<StripeConnectStatus> {
  if (!stripeAccountId) return 'no_account'

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    const activa = Boolean(account.charges_enabled && account.payouts_enabled)
    return activa ? 'active' : 'pending'
  } catch (error) {
    console.error('[stripe-connect] retrieve account error:', mensajeErrorStripe(error))
    return 'pending'
  }
}
