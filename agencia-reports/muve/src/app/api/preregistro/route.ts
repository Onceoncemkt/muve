import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'

const CIUDADES_VALIDAS = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']

function generarCodigo(): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `MUVET20-${random}`
}

function capitalizar(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function construirBaseUrl(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) return siteUrl.replace(/\/+$/, '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const protocol = req.headers.get('x-forwarded-proto') ?? 'https'
  if (host) return `${protocol}://${host}`
  return 'https://muvet.mx'
}

async function generarCodigoUnico(db: ReturnType<typeof createServiceClient>) {
  for (let intento = 0; intento < 10; intento += 1) {
    const codigo = generarCodigo()
    const { data: existe, error } = await db
      .from('preregistros')
      .select('id')
      .eq('codigo_descuento', codigo)
      .limit(1)

    if (error) throw error
    if ((existe ?? []).length === 0) return codigo
  }
  throw new Error('No se pudo generar un código único')
}

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY?.trim()
    const { email, ciudad, nombre } = await req.json()

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    if (!ciudad || !CIUDADES_VALIDAS.includes(String(ciudad).toLowerCase())) {
      return NextResponse.json({ error: 'Ciudad inválida' }, { status: 400 })
    }

    const db = createServiceClient()
    const emailNormalizado = String(email).toLowerCase().trim()
    const ciudadNormalizada = String(ciudad).toLowerCase().trim()

    const { data: existente } = await db
      .from('preregistros')
      .select('id, codigo_descuento, story_url')
      .eq('email', emailNormalizado)
      .maybeSingle<{ id: string; codigo_descuento: string; story_url: string | null }>()

    if (existente) {
      return NextResponse.json({
        ok: true,
        ya_registrado: true,
        codigo: existente.codigo_descuento,
        story_url: existente.story_url,
        mensaje: 'Este email ya está pre-registrado.'
      })
    }

    const codigo = await generarCodigoUnico(db)
    const ciudadCapitalizada = capitalizar(ciudadNormalizada)
    const nombreLimpio = typeof nombre === 'string' && nombre.trim() ? nombre.trim() : ''

    const baseUrl = construirBaseUrl(req)
    const storyUrl = `${baseUrl}/api/preregistro/story?codigo=${encodeURIComponent(codigo)}&ciudad=${encodeURIComponent(ciudadCapitalizada)}`

    const { error } = await db
      .from('preregistros')
      .insert({
        email: emailNormalizado,
        ciudad: ciudadNormalizada,
        nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
        codigo_descuento: codigo,
        story_url: storyUrl,
      })

    if (error) throw error

    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: emailNormalizado,
        subject: '¡Reservaste 20% durante 3 meses en MUVET! 🎉',
        html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tu 20% de descuento MUVET</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 600px;">
          
          <tr>
            <td style="background-color: #0A0A0A !important; padding: 32px 20px; text-align: center;">
              <h1 style="color: #E8FF47 !important; font-size: 36px; margin: 0; letter-spacing: 2px; font-weight: 700;">MUVET</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 32px; background-color: #ffffff;">
              <h2 style="color: #0A0A0A !important; font-size: 22px; margin: 0 0 16px 0; font-weight: 600;">¡Hola${nombreLimpio ? ` ${nombreLimpio}` : ''}! 👋</h2>
              
              <p style="color: #333333 !important; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                ¡Reservaste tu 20% de descuento en MUVET!
              </p>
              
              <p style="color: #333333 !important; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Cuando MUVET esté disponible en <b>${ciudadCapitalizada}</b>, te avisaremos y podrás usar este código:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #E8FF47 !important; padding: 24px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0; color: #0A0A0A !important; font-size: 12px; letter-spacing: 1.5px; font-weight: 600;">TU CÓDIGO EXCLUSIVO</p>
                    <p style="margin: 8px 0 0 0; color: #0A0A0A !important; font-size: 24px; font-weight: 700; letter-spacing: 2px;">${codigo}</p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333 !important; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Este descuento aplica al <b>20% durante 3 meses</b> de tu plan elegido (Básico, Plus o Total).
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #FFF8DC !important; border-left: 4px solid #6B4FE8 !important; padding: 16px 20px; border-radius: 0;">
                    <p style="margin: 0 0 8px 0; color: #6B4FE8 !important; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">PD: PRESUME QUE YA ESTÁS DENTRO 🎁</p>
                    <p style="margin: 0 0 12px 0; color: #444444 !important; font-size: 13px; line-height: 1.6;">
                      Sube esta imagen a tus stories tapando tu código y etiquétanos en <b>@muvet.mx</b>. Tus amigos se van a preguntar qué es esto... y tú serás de los primeros en disfrutarlo.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #0A0A0A !important; border-radius: 6px;">
                          <a href="${storyUrl}" style="display: inline-block; color: #E8FF47 !important; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600;">
                            Descargar mi imagen →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888 !important; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
                Te enviaremos un correo en cuanto estemos listos para recibirte.
              </p>
            </td>
          </tr>
          
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
`,
      })
    } else {
      console.warn('[preregistro] RESEND_API_KEY no configurada; se omite envío de correo.')
    }

    return NextResponse.json({
      ok: true,
      codigo,
      ciudad: ciudadCapitalizada,
      story_url: storyUrl,
    })
  } catch (err) {
    console.error('[preregistro]', err)
    return NextResponse.json(
      { error: 'Error al procesar tu registro. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
