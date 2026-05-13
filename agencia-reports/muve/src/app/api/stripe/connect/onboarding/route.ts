import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  crearOReutilizarCuentaYAccountLink,
  obtenerPerfilAcceso,
  resolverNegocioParaStripe,
} from '@/lib/stripe-connect'

type StripeLikeError = {
  message?: unknown
  code?: unknown
  type?: unknown
  statusCode?: unknown
  raw?: unknown
}

function serializarError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: String(error) }
  }
  const err = error as StripeLikeError
  return {
    message: typeof err.message === 'string' ? err.message : String(err.message ?? 'Unknown error'),
    code: typeof err.code === 'string' ? err.code : null,
    type: typeof err.type === 'string' ? err.type : null,
    statusCode: typeof err.statusCode === 'number' ? err.statusCode : null,
  }
}

export async function POST(request: NextRequest) {
  console.log('[stripe/connect/onboarding] POST start')
  console.log('[stripe/connect/onboarding] STRIPE_SECRET_KEY prefix:', process.env.STRIPE_SECRET_KEY?.slice(0, 8) ?? 'MISSING')
  console.log('[stripe/connect/onboarding] STRIPE_CONNECT_CLIENT_ID prefix:', process.env.STRIPE_CONNECT_CLIENT_ID?.slice(0, 10) ?? 'MISSING')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[stripe/connect/onboarding] user.id:', user?.id ?? 'null')
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const perfil = await obtenerPerfilAcceso(user.id)
    console.log('[stripe/connect/onboarding] perfil:', perfil)
    if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const negocioIdParam = searchParams.get('negocio_id')
    console.log('[stripe/connect/onboarding] negocio_id param:', negocioIdParam, 'negocio_id perfil:', perfil.negocio_id)

    const negocioResult = await resolverNegocioParaStripe(perfil, negocioIdParam)
    console.log('[stripe/connect/onboarding] negocioResult:', negocioResult)
    if (!negocioResult.ok) {
      return NextResponse.json({ error: negocioResult.error }, { status: negocioResult.status })
    }

    const linkResult = await crearOReutilizarCuentaYAccountLink(request.url, negocioResult.negocio, perfil.rol)
    console.log('[stripe/connect/onboarding] linkResult.ok:', linkResult.ok)
    if (!linkResult.ok) {
      console.error('[stripe/connect/onboarding] linkResult error:', linkResult.error, 'status:', linkResult.status)
      return NextResponse.json({ error: linkResult.error }, { status: linkResult.status })
    }

    return NextResponse.json({ url: linkResult.url })
  } catch (error) {
    console.error('[stripe/connect/onboarding] unhandled error:', error)
    const detalle = serializarError(error)
    return NextResponse.json({
      error: detalle.message,
      code: detalle.code,
      type: detalle.type,
      statusCode: detalle.statusCode,
    }, { status: 500 })
  }
}
