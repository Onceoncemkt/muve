import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { getEmailFrom } from '@/lib/email'

type ProspectoPayload = {
  categoria?: string
  nombre?: string
  ciudad?: string
  direccion?: string
  instagram?: string
  tiktok?: string
  contacto_nombre?: string
  contacto_email?: string
  contacto_telefono?: string
  clientes_mes?: string
  tiene_reservas?: boolean
  tiene_cuenta_bancaria?: boolean
  horario?: string
}

function texto(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function limpioHandle(value: string) {
  return value.replace(/^@+/, '').trim()
}

function filaEmail(etiqueta: string, valor: string) {
  return `<tr><td style="padding:6px 0;color:#888;font-size:12px;">${etiqueta}</td><td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${valor || '—'}</td></tr>`
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProspectoPayload

    const payload = {
      categoria: texto(body.categoria),
      nombre: texto(body.nombre),
      ciudad: texto(body.ciudad),
      direccion: texto(body.direccion),
      instagram: limpioHandle(texto(body.instagram)),
      tiktok: limpioHandle(texto(body.tiktok)),
      contacto_nombre: texto(body.contacto_nombre),
      contacto_email: texto(body.contacto_email).toLowerCase(),
      contacto_telefono: texto(body.contacto_telefono),
      clientes_mes: texto(body.clientes_mes),
      tiene_reservas: bool(body.tiene_reservas),
      tiene_cuenta_bancaria: bool(body.tiene_cuenta_bancaria),
      horario: texto(body.horario),
    }

    if (!payload.categoria) {
      return NextResponse.json({ error: 'La categoría es requerida.' }, { status: 400 })
    }
    if (!payload.nombre) {
      return NextResponse.json({ error: 'El nombre del negocio es requerido.' }, { status: 400 })
    }
    if (!payload.contacto_nombre) {
      return NextResponse.json({ error: 'El nombre de contacto es requerido.' }, { status: 400 })
    }
    if (!payload.contacto_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.contacto_email)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }
    if (!payload.contacto_telefono) {
      return NextResponse.json({ error: 'El teléfono es requerido.' }, { status: 400 })
    }
    if (payload.tiene_reservas === null || payload.tiene_cuenta_bancaria === null) {
      return NextResponse.json({ error: 'Completa la sección de operación.' }, { status: 400 })
    }

    const db = createServiceClient()
    const { error } = await db.from('prospectos_negocios').insert({
      categoria: payload.categoria,
      nombre: payload.nombre,
      ciudad: payload.ciudad || null,
      direccion: payload.direccion || null,
      instagram: payload.instagram || null,
      tiktok: payload.tiktok || null,
      contacto_nombre: payload.contacto_nombre,
      contacto_email: payload.contacto_email,
      contacto_telefono: payload.contacto_telefono,
      clientes_mes: payload.clientes_mes || null,
      tiene_reservas: payload.tiene_reservas,
      tiene_cuenta_bancaria: payload.tiene_cuenta_bancaria,
      horario: payload.horario || null,
    })

    if (error) throw error

    const resendApiKey = process.env.RESEND_API_KEY?.trim()
    if (resendApiKey) {
      const resend = new Resend(resendApiKey)

      await resend.emails.send({
        from: getEmailFrom(),
        to: 'hola@muvet.mx',
        subject: `Nuevo prospecto negocio: ${payload.nombre}`,
        html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#FFFFFF;border-radius:12px;padding:24px;">
            <tr>
              <td style="padding-bottom:16px;border-bottom:1px solid #EEE;">
                <p style="margin:0;color:#6B4FE8;font-size:12px;font-weight:800;letter-spacing:1px;">NUEVO PROSPECTO</p>
                <h1 style="margin:8px 0 0 0;color:#111;font-size:22px;">Registro de negocio en muvet.mx</h1>
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${filaEmail('Categoría', payload.categoria)}
                  ${filaEmail('Negocio', payload.nombre)}
                  ${filaEmail('Ciudad', payload.ciudad)}
                  ${filaEmail('Dirección', payload.direccion)}
                  ${filaEmail('Instagram', payload.instagram)}
                  ${filaEmail('TikTok', payload.tiktok)}
                  ${filaEmail('Contacto', payload.contacto_nombre)}
                  ${filaEmail('Email contacto', payload.contacto_email)}
                  ${filaEmail('Teléfono contacto', payload.contacto_telefono)}
                  ${filaEmail('Clientes/mes', payload.clientes_mes)}
                  ${filaEmail('Tiene reservas', payload.tiene_reservas ? 'Sí' : 'No')}
                  ${filaEmail('Tiene cuenta bancaria', payload.tiene_cuenta_bancaria ? 'Sí' : 'No')}
                  ${filaEmail('Horario', payload.horario)}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      })
    } else {
      console.warn('[negocios/registro] RESEND_API_KEY no configurada; se omite notificación por correo.')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[negocios/registro]', err)
    return NextResponse.json({ error: 'No se pudo registrar el prospecto.' }, { status: 500 })
  }
}
