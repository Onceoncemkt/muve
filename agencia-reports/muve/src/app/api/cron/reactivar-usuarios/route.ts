import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { enviarPushAUsuarios } from '@/lib/push/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type UsuarioReactivacion = {
  id: string
  nombre: string | null
  email: string | null
  rol: string | null
  plan_activo: boolean | null
  ultimo_checkin: string | null
}

type DescuentoCreado = {
  id: string
  codigo: string
  porcentaje: number | null
  fecha_expiracion: string | null
}

function esRequestAutorizado(request: NextRequest) {
  const esCronVercel = request.headers.get('x-vercel-cron') === '1'
  if (esCronVercel) return true

  const secretoCron = process.env.CRON_SECRET?.trim()
  if (!secretoCron) {
    return process.env.NODE_ENV === 'development'
  }

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${secretoCron}`
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function faltaRelacion(error: { message?: string } | null | undefined, relacion: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relacion.toLowerCase()) && message.includes('does not exist')
}

function normalizarTexto(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function generarCodigoRandom(longitud: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = randomBytes(longitud)
  let out = ''
  for (let i = 0; i < longitud; i += 1) {
    out += chars[bytes[i] % chars.length]
  }
  return out
}

function generarCodigoDescuento() {
  return `MUVET10-${generarCodigoRandom(6)}`
}

function esUsuarioCandidato(usuario: UsuarioReactivacion, limiteInactividadMs: number) {
  const planActivo = Boolean(usuario.plan_activo)
  if (!planActivo) return true

  if (!usuario.ultimo_checkin) return true
  const ultimoCheckin = new Date(usuario.ultimo_checkin)
  if (Number.isNaN(ultimoCheckin.getTime())) return true
  return ultimoCheckin.getTime() <= limiteInactividadMs
}

function plantillaReactivacion({
  nombreUsuario,
  codigo,
  linkReactivacion,
}: {
  nombreUsuario: string
  codigo: string
  linkReactivacion: string
}) {
  const nombreSeguro = escapeHtml(nombreUsuario)
  const codigoSeguro = escapeHtml(codigo)
  const linkSeguro = escapeHtml(linkReactivacion)

  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0A0A0A; color: #ffffff; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; border: 1px solid #1f1f1f; border-radius: 12px; padding: 24px;">
        <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #9ca3af; margin: 0 0 16px;">MUVET</p>
        <h1 style="font-size: 28px; line-height: 1.2; margin: 0 0 14px;">Te extrañamos</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 18px;">
          Hola ${nombreSeguro}, aquí tienes un descuento especial para volver a entrenar con MUVET.
        </p>
        <div style="display: inline-block; background: #E8FF47; color: #0A0A0A; font-weight: 800; font-size: 24px; letter-spacing: 0.08em; padding: 10px 14px; border-radius: 8px; margin-bottom: 18px;">
          ${codigoSeguro}
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #d1d5db; margin: 0 0 22px;">
          Válido por 7 días. Úsalo antes de que expire.
        </p>
        <a href="${linkSeguro}" style="display: inline-block; background: #E8FF47; color: #0A0A0A; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px;">
          Usar mi descuento
        </a>
      </div>
    </div>
  `
}

async function enviarEmailReactivacion({
  email,
  nombreUsuario,
  codigo,
  linkReactivacion,
}: {
  email: string
  nombreUsuario: string
  codigo: string
  linkReactivacion: string
}) {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM
  if (!resendApiKey || !fromEmail) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: '10% de descuento solo para ti — válido 7 días',
      html: plantillaReactivacion({
        nombreUsuario,
        codigo,
        linkReactivacion,
      }),
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    console.warn('[GET /api/cron/reactivar-usuarios] Error Resend', {
      status: response.status,
      payload,
    })
    return false
  }

  return true
}

async function crearDescuentoParaUsuario(
  db: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<DescuentoCreado> {
  const fechaExpiracion = new Date()
  fechaExpiracion.setDate(fechaExpiracion.getDate() + 7)

  for (let intento = 0; intento < 8; intento += 1) {
    const codigo = generarCodigoDescuento()
    const insercion = await db
      .from('descuentos')
      .insert({
        user_id: userId,
        codigo,
        porcentaje: 10,
        usado: false,
        fecha_expiracion: fechaExpiracion.toISOString(),
      })
      .select('id, codigo, porcentaje, fecha_expiracion')
      .maybeSingle<DescuentoCreado>()

    if (faltaRelacion(insercion.error, 'descuentos')) {
      throw new Error('Falta la tabla descuentos. Ejecuta la migración 018 en Supabase.')
    }

    if (insercion.error?.code === '23505') {
      continue
    }

    if (insercion.error || !insercion.data) {
      throw new Error(insercion.error?.message ?? 'No se pudo crear el descuento')
    }

    return insercion.data
  }

  throw new Error('No se pudo generar un código de descuento único')
}

function esErrorCouponExistente(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === 'resource_already_exists') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.toLowerCase().includes('already exists')
}

async function asegurarCouponStripe(descuento: DescuentoCreado, userId: string) {
  const porcentaje = typeof descuento.porcentaje === 'number'
    ? Math.max(Math.trunc(descuento.porcentaje), 1)
    : 10

  try {
    await stripe.coupons.retrieve(descuento.codigo)
    return
  } catch {
    // Se intenta crear si no existe.
  }

  try {
    await stripe.coupons.create({
      id: descuento.codigo,
      percent_off: porcentaje,
      duration: 'once',
      name: descuento.codigo,
      metadata: {
        user_id: userId,
        descuento_id: descuento.id,
      },
    })
  } catch (error) {
    if (!esErrorCouponExistente(error)) {
      throw error
    }
  }
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = createServiceClient()
  const consulta = await db
    .from('users')
    .select('id, nombre, email, rol, plan_activo, ultimo_checkin')
    .returns<UsuarioReactivacion[]>()

  if (faltaColumna(consulta.error, 'ultimo_checkin')) {
    return NextResponse.json(
      { error: 'Falta la columna users.ultimo_checkin. Ejecuta la migración 018 en Supabase.' },
      { status: 500 }
    )
  }

  if (consulta.error) {
    return NextResponse.json(
      { error: consulta.error.message ?? 'No se pudieron cargar usuarios para reactivación' },
      { status: 500 }
    )
  }

  const limiteInactividad = new Date()
  limiteInactividad.setDate(limiteInactividad.getDate() - 40)
  const limiteInactividadMs = limiteInactividad.getTime()

  const candidatos = (consulta.data ?? [])
    .filter((usuario) => usuario.rol === 'usuario')
    .filter((usuario) => esUsuarioCandidato(usuario, limiteInactividadMs))

  const origin = new URL(request.url).origin
  let procesados = 0
  let codigosGenerados = 0
  let pushNotificados = 0
  let emailsEnviados = 0
  let errores = 0

  for (const usuario of candidatos) {
    try {
      const descuento = await crearDescuentoParaUsuario(db, usuario.id)
      codigosGenerados += 1
      await asegurarCouponStripe(descuento, usuario.id)

      const pushResult = await enviarPushAUsuarios(
        [usuario.id],
        {
          title: 'MUVET',
          body: `Te echamos de menos. Aquí tienes 10% de descuento: ${descuento.codigo}`,
          url: `/planes?codigo_descuento=${encodeURIComponent(descuento.codigo)}`,
        }
      )
      if (pushResult.sent > 0) pushNotificados += 1

      const email = normalizarTexto(usuario.email).toLowerCase()
      if (email) {
        const emailOk = await enviarEmailReactivacion({
          email,
          nombreUsuario: normalizarTexto(usuario.nombre) || 'usuario',
          codigo: descuento.codigo,
          linkReactivacion: `${origin}/planes?codigo_descuento=${encodeURIComponent(descuento.codigo)}`,
        })
        if (emailOk) emailsEnviados += 1
      }

      procesados += 1
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'error desconocido'
      if (mensaje.includes('Falta la tabla descuentos')) {
        return NextResponse.json({ error: mensaje }, { status: 500 })
      }

      errores += 1
      console.error('[GET /api/cron/reactivar-usuarios] Error procesando usuario', {
        user_id: usuario.id,
        mensaje,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: candidatos.length,
    procesados,
    codigos_generados: codigosGenerados,
    push_notificados: pushNotificados,
    emails_enviados: emailsEnviados,
    errores,
  })
}
