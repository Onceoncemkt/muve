import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { normalizarPlan, obtenerStripePriceIdsCandidatos, obtenerStripePriceIdsPorRegion, planDesdePriceId } from '@/lib/planes'

type PerfilCheckout = {
  nombre: string | null
  email: string | null
  stripe_customer_id: string | null
  plan_activo: boolean | null
  ciudad: string | null
}
function esErrorStripePriceNoExiste(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  const param = (error as { param?: unknown }).param
  const message = (error as { message?: unknown }).message
  const messageNormalizado = typeof message === 'string' ? message.toLowerCase() : ''
  return (
    code === 'resource_missing'
    && param === 'line_items[0][price]'
    && messageNormalizado.includes('no such price')
  )
}

function esErrorStripeCustomerNoExiste(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  const param = (error as { param?: unknown }).param
  const message = (error as { message?: unknown }).message
  const messageNormalizado = typeof message === 'string' ? message.toLowerCase() : ''
  return (
    code === 'resource_missing'
    && param === 'customer'
    && messageNormalizado.includes('no such customer')
  )
}

type DescuentoDisponible = {
  id: string
  codigo: string
  porcentaje: number
}

type DescuentoDisponibleRow = {
  id: string
  codigo: string
  porcentaje: number | null
}

function esCiudadBC(ciudad: string | null | undefined) {
  return ciudad === 'tijuana'
}

function normalizarCodigoDescuento(value: unknown) {
  if (typeof value !== 'string') return null
  const limpio = value.trim().toUpperCase()
  return limpio.length > 0 ? limpio : null
}

function faltaRelacion(error: { message?: string } | null | undefined, relacion: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relacion.toLowerCase()) && message.includes('does not exist')
}

function esErrorCouponExistente(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === 'resource_already_exists') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.toLowerCase().includes('already exists')
}

async function asegurarCouponStripe(codigo: string, porcentaje: number) {
  try {
    await stripe.coupons.retrieve(codigo)
    return
  } catch {
    // Se crea si no existe.
  }

  try {
    await stripe.coupons.create({
      id: codigo,
      percent_off: porcentaje,
      duration: 'once',
      name: codigo,
    })
  } catch (error) {
    if (!esErrorCouponExistente(error)) {
      throw error
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body: Record<string, unknown> = await request.json().catch(() => ({}))
    const priceIdSolicitado = typeof body.priceId === 'string' ? body.priceId : ''
    const codigoDescuento = normalizarCodigoDescuento(body.codigo_descuento)
    const planSolicitado = planDesdePriceId(priceIdSolicitado)
      ?? normalizarPlan(body.planId ?? body.plan ?? body.plan_id)

    if (!planSolicitado) {
      return NextResponse.json({ error: 'Plan inválido. Usa planId basico, plus o total.' }, { status: 400 })
    }

    const { data: perfil } = await supabase
      .from('users')
      .select('nombre, email, stripe_customer_id, plan_activo, ciudad')
      .eq('id', user.id)
      .single<PerfilCheckout>()

    if (perfil?.plan_activo) {
      return NextResponse.json({ error: 'Ya tienes una membresía activa' }, { status: 400 })
    }

    let priceIdsCiudad: Record<'basico' | 'plus' | 'total', string>
    let regionActiva: 'centro' | 'bc' = 'centro'
    try {
      const { centro, bc } = obtenerStripePriceIdsPorRegion()
      regionActiva = esCiudadBC(perfil?.ciudad) ? 'bc' : 'centro'
      priceIdsCiudad = regionActiva === 'bc' ? bc : centro
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error
            ? error.message
            : 'Configuración de Stripe incompleta',
        },
        { status: 500 }
      )
    }

    const priceIdFinal = priceIdsCiudad[planSolicitado]
    if (!priceIdFinal) {
      return NextResponse.json({ error: 'Configuración de precios incompleta' }, { status: 500 })
    }

    let descuentoAplicado: DescuentoDisponible | null = null
    if (codigoDescuento) {
      const db = createServiceClient()
      const consultaDescuento = await db
        .from('descuentos')
        .select('id, codigo, porcentaje')
        .eq('codigo', codigoDescuento)
        .eq('usado', false)
        .gt('fecha_expiracion', new Date().toISOString())
        .maybeSingle<DescuentoDisponibleRow>()

      if (faltaRelacion(consultaDescuento.error, 'descuentos')) {
        return NextResponse.json(
          { error: 'Falta la tabla descuentos. Ejecuta la migración 018 en Supabase.' },
          { status: 500 }
        )
      }

      if (consultaDescuento.error) {
        return NextResponse.json(
          { error: consultaDescuento.error.message ?? 'No se pudo validar el código de descuento' },
          { status: 500 }
        )
      }

      if (!consultaDescuento.data) {
        return NextResponse.json({ error: 'Código de descuento inválido o expirado' }, { status: 400 })
      }

      descuentoAplicado = {
        id: consultaDescuento.data.id,
        codigo: consultaDescuento.data.codigo,
        porcentaje: typeof consultaDescuento.data.porcentaje === 'number'
          ? Math.max(Math.trunc(consultaDescuento.data.porcentaje), 1)
          : 10,
      }

      try {
        await asegurarCouponStripe(descuentoAplicado.codigo, descuentoAplicado.porcentaje)
      } catch (error) {
        return NextResponse.json(
          {
            error: `No se pudo preparar el cupón de Stripe: ${error instanceof Error ? error.message : 'error desconocido'}`,
          },
          { status: 502 }
        )
      }
    }

    let customerId = perfil?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: perfil?.email ?? user.email!,
        name: perfil?.nombre ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }
    const obtenerCustomerIdRequerido = () => {
      if (!customerId) {
        throw new Error('customerId requerido en este punto')
      }
      return customerId
    }

    const origin = new URL(request.url).origin
    const metadata: Record<string, string> = { supabase_user_id: user.id }
    if (descuentoAplicado) {
      metadata.descuento_id = descuentoAplicado.id
      metadata.codigo_descuento = descuentoAplicado.codigo
    }

    const crearSessionCheckout = (customer: string, priceId: string) => stripe.checkout.sessions.create({
      customer,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?membresia=activada`,
      cancel_url: `${origin}/`,
      discounts: descuentoAplicado ? [{ coupon: descuentoAplicado.codigo }] : undefined,
      metadata,
      subscription_data: {
        metadata,
      },
    })

    const crearSessionConCustomerFallback = async (priceId: string) => {
      try {
        return await crearSessionCheckout(obtenerCustomerIdRequerido(), priceId)
      } catch (error) {
        if (!esErrorStripeCustomerNoExiste(error)) {
          throw error
        }

        const customerNuevo = await stripe.customers.create({
          email: perfil?.email ?? user.email!,
          name: perfil?.nombre ?? undefined,
          metadata: { supabase_user_id: user.id },
        })
        customerId = customerNuevo.id

        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)
        return crearSessionCheckout(obtenerCustomerIdRequerido(), priceId)
      }
    }

    let session
    try {
      session = await crearSessionConCustomerFallback(priceIdFinal)
    } catch (error) {
      if (!esErrorStripePriceNoExiste(error)) {
        throw error
      }
      const candidatosAlternos = obtenerStripePriceIdsCandidatos(regionActiva, planSolicitado)
        .filter((priceId) => priceId !== priceIdFinal)
      let sessionAlterna = null
      for (const priceIdAlterno of candidatosAlternos) {
        try {
          sessionAlterna = await crearSessionConCustomerFallback(priceIdAlterno)
          break
        } catch {
          // Intentar siguiente candidato.
        }
      }
      if (!sessionAlterna) {
        return NextResponse.json(
          {
            error: `Price ID inválido o no disponible en Stripe para ${planSolicitado}/${regionActiva}. Revisa variables de entorno.`,
          },
          { status: 500 }
        )
      }
      session = sessionAlterna
    }

    return NextResponse.json({
      url: session.url,
      descuento_aplicado: descuentoAplicado?.codigo ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'No se pudo iniciar el checkout',
      },
      { status: 500 }
    )
  }
}
