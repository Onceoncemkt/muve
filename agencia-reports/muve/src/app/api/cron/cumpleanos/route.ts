import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enviarPushAUsuarios } from '@/lib/push/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MOTIVO_CUMPLEANOS = 'Regalo de cumpleaños MUVET'

type UsuarioCumpleanos = {
  id: string
  nombre: string | null
  email: string | null
  rol: string | null
  plan_activo: boolean | null
  fecha_nacimiento: string | null
  creditos_extra: number | null
}

type CreditoHistorial = {
  user_id: string
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
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;')
}

function cumpleHoy(fechaNacimiento: string | null, ahora: Date) {
  if (!fechaNacimiento) return false
  const nacimiento = new Date(fechaNacimiento)
  if (Number.isNaN(nacimiento.getTime())) return false
  return nacimiento.getUTCMonth() === ahora.getUTCMonth()
    && nacimiento.getUTCDate() === ahora.getUTCDate()
}

function inicioDiaUTC(fecha: Date) {
  const inicio = new Date(fecha)
  inicio.setUTCHours(0, 0, 0, 0)
  return inicio
}

function plantillaCumpleanos({
  nombreUsuario,
  dashboardUrl,
}: {
  nombreUsuario: string
  dashboardUrl: string
}) {
  const nombreSeguro = escapeHtml(nombreUsuario)
  const dashboardSeguro = escapeHtml(dashboardUrl)

  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0A0A0A; color: #ffffff; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; border: 1px solid #1f1f1f; border-radius: 12px; padding: 24px;">
        <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #9ca3af; margin: 0 0 16px;">MUVET</p>
        <h1 style="font-size: 38px; line-height: 1.1; margin: 0 0 16px; color: #E8FF47; font-weight: 900;">FELIZ CUMPLEAÑOS</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 12px;">
          Hola ${nombreSeguro},
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 20px;">
          Te regalamos 2 visitas extra este mes para que lo celebres como mereces.
        </p>
        <a href="${dashboardSeguro}" style="display: inline-block; background: #E8FF47; color: #0A0A0A; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px;">
          Ver mis visitas
        </a>
      </div>
    </div>
  `
}

async function enviarEmailCumpleanos({
  email,
  nombreUsuario,
  dashboardUrl,
}: {
  email: string
  nombreUsuario: string
  dashboardUrl: string
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
      subject: `Feliz cumpleaños ${nombreUsuario} — MUVET te tiene un regalo`,
      html: plantillaCumpleanos({
        nombreUsuario,
        dashboardUrl,
      }),
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    console.warn('[GET /api/cron/cumpleanos] Error Resend', {
      status: response.status,
      payload,
    })
    return false
  }

  return true
}

export async function GET(request: NextRequest) {
  if (!esRequestAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = createServiceClient()
  const consultaUsuarios = await db
    .from('users')
    .select('id, nombre, email, rol, plan_activo, fecha_nacimiento, creditos_extra')
    .eq('plan_activo', true)
    .returns<UsuarioCumpleanos[]>()

  if (faltaColumna(consultaUsuarios.error, 'fecha_nacimiento')) {
    return NextResponse.json(
      { error: 'Falta la columna users.fecha_nacimiento para procesar cumpleaños.' },
      { status: 500 }
    )
  }

  if (faltaColumna(consultaUsuarios.error, 'creditos_extra')) {
    return NextResponse.json(
      { error: 'Falta la columna users.creditos_extra. Ejecuta la migración 020 en Supabase.' },
      { status: 500 }
    )
  }

  if (consultaUsuarios.error) {
    return NextResponse.json(
      { error: consultaUsuarios.error.message ?? 'No se pudieron cargar usuarios para cumpleaños' },
      { status: 500 }
    )
  }

  const ahora = new Date()
  const cumpleaneros = (consultaUsuarios.data ?? [])
    .filter((usuario) => usuario.rol === 'usuario')
    .filter((usuario) => cumpleHoy(usuario.fecha_nacimiento, ahora))

  if (cumpleaneros.length === 0) {
    return NextResponse.json({
      ok: true,
      candidatos: 0,
      procesados: 0,
      push_notificados: 0,
      emails_enviados: 0,
    })
  }

  const inicioDia = inicioDiaUTC(ahora)
  const finDia = new Date(inicioDia)
  finDia.setUTCDate(finDia.getUTCDate() + 1)

  const consultaHistorialHoy = await db
    .from('creditos_historial')
    .select('user_id')
    .in('user_id', cumpleaneros.map((usuario) => usuario.id))
    .eq('motivo', MOTIVO_CUMPLEANOS)
    .gte('created_at', inicioDia.toISOString())
    .lt('created_at', finDia.toISOString())
    .returns<CreditoHistorial[]>()

  if (faltaRelacion(consultaHistorialHoy.error, 'creditos_historial')) {
    return NextResponse.json(
      { error: 'Falta la tabla creditos_historial. Ejecuta la migración 020 en Supabase.' },
      { status: 500 }
    )
  }

  if (consultaHistorialHoy.error) {
    return NextResponse.json(
      { error: consultaHistorialHoy.error.message ?? 'No se pudo validar historial de cumpleaños' },
      { status: 500 }
    )
  }

  const yaRegaladosHoy = new Set((consultaHistorialHoy.data ?? []).map((row) => row.user_id))
  const pendientes = cumpleaneros.filter((usuario) => !yaRegaladosHoy.has(usuario.id))

  const origin = new URL(request.url).origin
  let procesados = 0
  let pushEnviados = 0
  let emailsEnviados = 0
  let errores = 0

  for (const usuario of pendientes) {
    try {
      const creditosActuales = Math.max(Math.trunc(usuario.creditos_extra ?? 0), 0)
      const creditosActualizados = creditosActuales + 2

      const { error: updateError } = await db
        .from('users')
        .update({ creditos_extra: creditosActualizados })
        .eq('id', usuario.id)

      if (updateError) {
        throw new Error(updateError.message ?? 'No se pudo actualizar creditos_extra')
      }

      const { error: historialError } = await db
        .from('creditos_historial')
        .insert({
          user_id: usuario.id,
          cantidad: 2,
          motivo: MOTIVO_CUMPLEANOS,
        })

      if (historialError) {
        throw new Error(historialError.message ?? 'No se pudo registrar historial de créditos')
      }

      const pushResult = await enviarPushAUsuarios(
        [usuario.id],
        {
          title: 'MUVET',
          body: 'Feliz cumpleaños! MUVET te regala 2 visitas extra este mes',
          url: '/dashboard',
        }
      )
      if (pushResult.sent > 0) pushEnviados += 1

      const email = normalizarTexto(usuario.email).toLowerCase()
      if (email) {
        const nombreUsuario = normalizarTexto(usuario.nombre) || 'Muver'
        const emailOk = await enviarEmailCumpleanos({
          email,
          nombreUsuario,
          dashboardUrl: `${origin}/dashboard`,
        })
        if (emailOk) emailsEnviados += 1
      }

      procesados += 1
    } catch (error) {
      errores += 1
      console.error('[GET /api/cron/cumpleanos] Error procesando cumpleañero', {
        user_id: usuario.id,
        mensaje: error instanceof Error ? error.message : 'error desconocido',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: cumpleaneros.length,
    pendientes: pendientes.length,
    procesados,
    push_notificados: pushEnviados,
    emails_enviados: emailsEnviados,
    errores,
  })
}
