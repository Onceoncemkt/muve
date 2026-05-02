import { NextRequest, NextResponse } from 'next/server'

type BienvenidaPayload = {
  email?: string
  nombre?: string
}

function normalizarTexto(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function esEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plantillaBienvenida(nombre: string, faqUrl: string) {
  const nombreSeguro = escapeHtml(nombre)
  const faqUrlSeguro = escapeHtml(faqUrl)
  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0A0A0A; color: #ffffff; padding: 24px;">
      <div style="max-width: 520px; margin: 0 auto; border: 1px solid #1f1f1f; border-radius: 12px; padding: 24px;">
        <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #9ca3af; margin: 0 0 16px;">MUVET</p>
        <h1 style="font-size: 28px; line-height: 1.2; margin: 0 0 16px;">¡Bienvenido/a, ${nombreSeguro}!</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 16px;">
          Tu cuenta fue creada correctamente. Ya puedes explorar gimnasios, reservar clases y gestionar tu membresía desde MUVET.
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0;">
          Si este registro no fue realizado por ti, ignora este correo.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #d1d5db; margin: 16px 0 0;">
          Consulta nuestras preguntas frecuentes aquí:
          <a href="${faqUrlSeguro}" style="color: #E8FF47; text-decoration: none; font-weight: 700;">
            FAQ MUVET
          </a>
        </p>
      </div>
    </div>
  `
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM

  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: 'Falta configurar RESEND_API_KEY y/o EMAIL_FROM en el servidor' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null) as BienvenidaPayload | null
  const origin = new URL(request.url).origin
  const email = normalizarTexto(body?.email).toLowerCase()
  const nombre = normalizarTexto(body?.nombre) || 'bienvenido'

  if (!email || !esEmailValido(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: '¡Bienvenido a MUVET!',
      html: plantillaBienvenida(nombre, `${origin}/#faq`),
    }),
  })

  const resendPayload = await resendResponse.json().catch(() => null)

  if (!resendResponse.ok) {
    console.error('[POST /api/email/bienvenida] Error Resend', {
      status: resendResponse.status,
      payload: resendPayload,
    })
    return NextResponse.json({ error: 'No se pudo enviar el email de bienvenida' }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    id: typeof resendPayload?.id === 'string' ? resendPayload.id : null,
  })
}
