import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'
import type { Ciudad, Rol } from '@/types'

const CIUDADES_VALIDAS: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']

type PreregistroPendiente = {
  id: string
  email: string
  nombre: string | null
  codigo_descuento: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const db = createServiceClient()
    const { data: userData } = await db
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle<{ rol: Rol }>()

    if (userData?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const ciudad = typeof body.ciudad === 'string' ? body.ciudad.toLowerCase().trim() : ''

    if (!ciudad || !CIUDADES_VALIDAS.includes(ciudad as Ciudad)) {
      return NextResponse.json({ error: 'Ciudad inválida' }, { status: 400 })
    }

    const { data: preregistros, error: errorFetch } = await db
      .from('preregistros')
      .select('id, email, nombre, codigo_descuento')
      .eq('ciudad', ciudad)
      .eq('estado', 'pendiente')
      .is('notificado_lanzamiento_at', null)

    if (errorFetch) throw errorFetch

    const pendientes = (preregistros ?? []) as PreregistroPendiente[]
    if (pendientes.length === 0) {
      return NextResponse.json({
        ok: true,
        enviados: 0,
        errores: 0,
        mensaje: 'No hay pre-registros pendientes en esta ciudad',
      })
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim()
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Resend no configurado' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://muvet.mx').replace(/\/+$/, '')
    const ciudadCapitalizada = ciudad.charAt(0).toUpperCase() + ciudad.slice(1).toLowerCase()

    let enviados = 0
    let errores = 0
    const ahora = new Date()
    const expiraAt = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expiraLegible = expiraAt.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    for (const pre of pendientes) {
      try {
        const linkRegistro = `${baseUrl}/registro?codigo=${encodeURIComponent(pre.codigo_descuento)}`

        await resend.emails.send({
          from: fromEmail,
          to: pre.email,
          subject: `🎉 ¡MUVET llegó a ${ciudadCapitalizada}! Tu 20% expira en 7 días`,
          html: emailLanzamientoTemplate({
            nombre: pre.nombre,
            codigo: pre.codigo_descuento,
            ciudad: ciudadCapitalizada,
            linkRegistro,
            expiraAt: expiraLegible,
          }),
        })

        const { error: updateError } = await db
          .from('preregistros')
          .update({
            notificado_lanzamiento_at: ahora.toISOString(),
            codigo_expira_at: expiraAt.toISOString(),
          })
          .eq('id', pre.id)
          .eq('estado', 'pendiente')
          .is('notificado_lanzamiento_at', null)

        if (updateError) throw updateError
        enviados++
      } catch (err) {
        console.error(`[notificar] Error con ${pre.email}:`, err)
        errores++
      }
    }

    return NextResponse.json({
      ok: true,
      total: pendientes.length,
      enviados,
      errores,
      ciudad: ciudadCapitalizada,
    })
  } catch (err) {
    console.error('[notificar]', err)
    return NextResponse.json({ error: 'Error al enviar notificaciones' }, { status: 500 })
  }
}

function emailLanzamientoTemplate({
  nombre,
  codigo,
  ciudad,
  linkRegistro,
  expiraAt,
}: {
  nombre: string | null
  codigo: string
  ciudad: string
  linkRegistro: string
  expiraAt: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>MUVET ya está en ${ciudad}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 600px;">
          <!-- Header negro con logo amarillo -->
          <tr>
            <td style="background-color: #0A0A0A !important; padding: 32px 20px; text-align: center;">
              <h1 style="color: #E8FF47 !important; font-size: 36px; margin: 0; letter-spacing: 2px; font-weight: 700;">MUVET</h1>
              <p style="color: #ffffff !important; font-size: 14px; margin: 8px 0 0 0; opacity: 0.7;">Ya estamos en ${ciudad} 🎉</p>
            </td>
          </tr>
          <!-- Cuerpo blanco -->
          <tr>
            <td style="padding: 32px; background-color: #ffffff;">
              <h2 style="color: #0A0A0A !important; font-size: 24px; margin: 0 0 16px 0; font-weight: 700;">¡Hola${nombre ? ` ${nombre}` : ''}! 🎁</h2>
              
              <p style="color: #333333 !important; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Llegó el día que estabas esperando.
              </p>
              
              <p style="color: #333333 !important; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                <b>MUVET ya está disponible en ${ciudad}.</b> Y como prometimos, tu código exclusivo está listo para usarse:
              </p>
              <!-- Caja amarilla con código -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #E8FF47 !important; padding: 24px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0; color: #0A0A0A !important; font-size: 12px; letter-spacing: 1.5px; font-weight: 600;">TU CÓDIGO DE 20% OFF</p>
                    <p style="margin: 8px 0 0 0; color: #0A0A0A !important; font-size: 24px; font-weight: 700; letter-spacing: 2px;">${codigo}</p>
                  </td>
                </tr>
              </table>
              <!-- Acento morado decorativo (paleta MUVET completa) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F5F3FF !important; border-left: 4px solid #6B4FE8 !important; padding: 16px 20px; border-radius: 0;">
                    <p style="margin: 0; color: #6B4FE8 !important; font-size: 13px; font-weight: 600; line-height: 1.6;">
                      💜 Eres parte de los primeros 100 con descuento. Gracias por confiar en MUVET desde el día uno.
                    </p>
                  </td>
                </tr>
              </table>
              <!-- Urgencia con acento rojo -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #FFF0F0 !important; border-left: 4px solid #DC2626 !important; padding: 16px 20px; border-radius: 0;">
                    <p style="margin: 0 0 4px 0; color: #DC2626 !important; font-size: 14px; font-weight: 700;">⏰ TU CÓDIGO EXPIRA EL ${expiraAt.toUpperCase()}</p>
                    <p style="margin: 0; color: #444444 !important; font-size: 13px; line-height: 1.6;">
                      Después de esa fecha, ya no podrás usar este descuento.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333 !important; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Crea tu cuenta hoy y disfruta del <b>20% durante tus primeros 3 meses</b> en cualquier plan que elijas.
              </p>
              <!-- CTA principal con paleta MUVET (botón negro + texto amarillo) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #0A0A0A !important; border-radius: 8px;">
                          <a href="${linkRegistro}" style="display: inline-block; color: #E8FF47 !important; padding: 16px 32px; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">
                            Crear mi cuenta y aplicar 20% →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666 !important; font-size: 13px; line-height: 1.6; margin: 32px 0 0 0; text-align: center;">
                ¿Preguntas? Responde este correo o escríbenos a hola@muvet.mx
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f5 !important; padding: 16px; text-align: center;">
              <p style="color: #888888 !important; font-size: 11px; margin: 0;">MUVET · muvet.mx</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
</body>
</html>
`
}
