import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { EstadoReserva } from '@/types'
import { formatHora } from '@/types'
import { getEmailFrom } from '@/lib/email'
import { enviarPushAUsuarios, obtenerStaffIdsPorNegocio } from '@/lib/push/server'
import { normalizarPlan, puedeReservarConPlan } from '@/lib/planes'
import { planExpirado } from '@/lib/ciclos'
import { registrarVisitaPorReservacionCompletada } from '@/lib/visitas'
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plantillaCancelacionReservaNegocio({
  nombreUsuario,
  fecha,
  hora,
  tipoServicio,
  creditoDevuelto,
}: {
  nombreUsuario: string
  fecha: string
  hora: string
  tipoServicio: string
  creditoDevuelto: boolean
}) {
  const nombreSeguro = escapeHtml(nombreUsuario)
  const fechaSegura = escapeHtml(fecha)
  const horaSegura = escapeHtml(hora)
  const tipoServicioSeguro = escapeHtml(tipoServicio)
  const estatusCredito = creditoDevuelto
    ? 'El crédito fue devuelto al usuario'
    : 'Cancelación tardía — el crédito NO fue devuelto'

  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0A0A0A; color: #ffffff; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; border: 1px solid #1f1f1f; border-radius: 12px; overflow: hidden;">
        <div style="padding: 20px 24px; border-bottom: 1px solid #1f1f1f;">
          <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #E8FF47; margin: 0;">MUVET</p>
          <h1 style="font-size: 24px; line-height: 1.2; margin: 10px 0 0;">Reservación cancelada</h1>
        </div>
        <div style="padding: 20px 24px;">
          <p style="margin: 0 0 12px; color: #d1d5db;">Un usuario canceló una reservación en tu negocio:</p>
          <p style="margin: 0 0 8px;"><strong>Usuario:</strong> ${nombreSeguro}</p>
          <p style="margin: 0 0 8px;"><strong>Fecha:</strong> ${fechaSegura}</p>
          <p style="margin: 0 0 8px;"><strong>Hora:</strong> ${horaSegura}</p>
          <p style="margin: 0 0 8px;"><strong>Clase / servicio:</strong> ${tipoServicioSeguro}</p>
          <p style="margin: 12px 0 0; color: ${creditoDevuelto ? '#E8FF47' : '#fca5a5'}; font-weight: 700;">${estatusCredito}</p>
          <div style="margin-top: 18px;">
            <a href="https://muvet.mx/negocio/dashboard" style="display: inline-block; background: #E8FF47; color: #0A0A0A; text-decoration: none; font-weight: 800; padding: 10px 14px; border-radius: 8px;">
              Ir al panel del negocio
            </a>
          </div>
        </div>
      </div>
    </div>
  `
}

async function enviarEmailCancelacionReservaNegocio({
  email,
  nombreUsuario,
  fecha,
  hora,
  tipoServicio,
  creditoDevuelto,
}: {
  email: string | null
  nombreUsuario: string
  fecha: string
  hora: string
  tipoServicio: string
  creditoDevuelto: boolean
}) {
  if (!email) return

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = getEmailFrom()
  if (!resendApiKey) return

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Reservación cancelada — ${nombreUsuario} — ${hora}`,
        html: plantillaCancelacionReservaNegocio({
          nombreUsuario,
          fecha,
          hora,
          tipoServicio,
          creditoDevuelto,
        }),
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      console.warn('[PATCH /api/reservaciones/[id]] No se pudo enviar email de cancelación al negocio', payload)
    }
  } catch (error) {
    console.warn('[PATCH /api/reservaciones/[id]] Error enviando email de cancelación al negocio', error)
  }
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/reservaciones/[id] — cancelar (usuario) o completar (staff)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Debes iniciar sesión y activar un plan para reservar.' },
      { status: 401 }
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const estado: EstadoReserva = body.estado

  if (!['cancelada', 'completada'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const db = admin()
  const { data: perfilActual, error: perfilActualError } = await db
    .from('users')
    .select('rol, nombre, plan_activo, plan, fecha_fin_plan')
    .eq('id', user.id)
    .maybeSingle<{
      rol: 'usuario' | 'staff' | 'admin'
      nombre: string | null
      plan_activo: boolean
      plan: string | null
      fecha_fin_plan: string | null
    }>()

  if (perfilActualError || !perfilActual) {
    return NextResponse.json({ error: 'No se pudo validar tu membresía' }, { status: 500 })
  }

  if (perfilActual.rol === 'usuario') {
    if (!perfilActual.plan_activo || !normalizarPlan(perfilActual.plan ?? null)) {
      return NextResponse.json({ error: 'Necesitas un plan activo para reservar.' }, { status: 403 })
    }
    if (planExpirado(perfilActual.fecha_fin_plan)) {
      await db
        .from('users')
        .update({ plan_activo: false })
        .eq('id', user.id)
      return NextResponse.json({ error: 'Necesitas un plan activo para reservar.' }, { status: 403 })
    }
  }

  // Obtener reservación
  const { data: reserva, error: fetchError } = await db
    .from('reservaciones')
    .select('id, user_id, estado, fecha, horario_id, servicio_nombre')
    .eq('id', id)
    .single<{
      id: string
      user_id: string
      estado: EstadoReserva
      fecha: string
      horario_id: string
      servicio_nombre: string | null
    }>()

  if (fetchError || !reserva) {
    return NextResponse.json({ error: 'Reservación no encontrada' }, { status: 404 })
  }

  // Permisos
  const esPropia = reserva.user_id === user.id
  let negocioId: string | null = null
  let negocioNombre = 'negocio'
  let negocioEmail: string | null = null
  let horaReserva = ''
  let tipoServicio = reserva.servicio_nombre ?? 'Clase'
  let creditoDevuelto = false

  if (estado === 'cancelada') {
    if (!esPropia) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { data: horario, error: horarioError } = await db
      .from('horarios')
      .select('hora_inicio, negocio_id, tipo_clase')
      .eq('id', reserva.horario_id)
      .maybeSingle<{ hora_inicio: string; negocio_id: string | null; tipo_clase: string | null }>()

    if (horarioError || !horario) {
      return NextResponse.json({ error: 'Horario no encontrado para esta reservación' }, { status: 400 })
    }
    horaReserva = formatHora(horario.hora_inicio)
    tipoServicio = reserva.servicio_nombre ?? horario.tipo_clase ?? 'Clase'

    negocioId = typeof horario.negocio_id === 'string' ? horario.negocio_id : null
    if (negocioId) {
      const consultasNegocio = [
        'nombre, nivel, plan_requerido, email',
        'nombre, nivel, plan_requerido, contacto_email',
        'nombre, nivel, plan_requerido, email_contacto',
        'nombre, nivel, plan_requerido',
      ] as const
      let negocio:
        | {
          nombre: string
          nivel?: 'basico' | 'plus' | 'total' | null
          plan_requerido?: 'basico' | 'plus' | 'total' | null
          email?: string | null
          contacto_email?: string | null
          email_contacto?: string | null
        }
        | null = null

      for (const select of consultasNegocio) {
        const { data, error } = await db
          .from('negocios')
          .select(select)
          .eq('id', negocioId)
          .maybeSingle<{
            nombre: string
            nivel?: 'basico' | 'plus' | 'total' | null
            plan_requerido?: 'basico' | 'plus' | 'total' | null
            email?: string | null
            contacto_email?: string | null
            email_contacto?: string | null
          }>()
        if (error) continue
        if (data) {
          negocio = data
          break
        }
      }
      negocioNombre = negocio?.nombre ?? 'negocio'
      const emailNegocio = typeof negocio?.email === 'string' ? negocio.email.trim() : ''
      const contactoEmail = typeof negocio?.contacto_email === 'string' ? negocio.contacto_email.trim() : ''
      const emailContacto = typeof negocio?.email_contacto === 'string' ? negocio.email_contacto.trim() : ''
      negocioEmail = emailNegocio || contactoEmail || emailContacto || null

      const planUsuario = normalizarPlan(perfilActual.plan ?? null) ?? 'basico'
      const nivelNegocio = negocio?.nivel === 'plus' || negocio?.nivel === 'total'
        ? negocio.nivel
        : negocio?.plan_requerido === 'plus' || negocio?.plan_requerido === 'total'
          ? negocio.plan_requerido
        : 'basico'
      if (!puedeReservarConPlan(planUsuario, nivelNegocio)) {
        return NextResponse.json(
          { error: nivelNegocio === 'plus' ? 'Este lugar requiere plan Plus' : 'Este lugar requiere plan Total' },
          { status: 403 }
        )
      }
    }

    // Solo se puede cancelar con más de 2h de anticipación
    const fechaHora = new Date(`${reserva.fecha}T${horario.hora_inicio}`)
    const diffMs = fechaHora.getTime() - Date.now()
    creditoDevuelto = diffMs >= 3 * 60 * 60 * 1000
    if (diffMs < 2 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Solo se puede cancelar con más de 2 horas de anticipación' },
        { status: 400 }
      )
    }
  }

  if (estado === 'completada') {
    // Solo staff/admin puede marcar completada
    if (!['staff', 'admin'].includes(perfilActual.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const { error: updateError } = await db
    .from('reservaciones')
    .update({ estado })
    .eq('id', id)

  if (updateError) {
    console.error('[PATCH /api/reservaciones/id]', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Al completar una reservación se registra la visita y el monto al negocio,
  // igual que /api/validar con el QR. Solo si NO estaba ya completada (idempotencia).
  if (estado === 'completada' && reserva.estado !== 'completada') {
    const resultadoVisita = await registrarVisitaPorReservacionCompletada(
      db,
      {
        id: reserva.id,
        user_id: reserva.user_id,
        fecha: reserva.fecha,
        horario_id: reserva.horario_id,
      },
      perfilActual.nombre ?? null
    )
    if (!resultadoVisita.ok) {
      console.warn('[PATCH /api/reservaciones/[id]] No se pudo registrar la visita', resultadoVisita.error)
    }
  }

  if (estado === 'cancelada') {
    const { data: usuario } = await db
      .from('users')
      .select('nombre')
      .eq('id', reserva.user_id)
      .maybeSingle<{ nombre: string }>()

    const usuarioNombre = usuario?.nombre ?? user.email?.split('@')[0] ?? 'Usuario'

    if (negocioId) {
      const staffIds = await obtenerStaffIdsPorNegocio(negocioId)
      if (staffIds.length > 0) {
        const payloadStaff = {
          title: 'Reservación cancelada',
          body: `${usuarioNombre} · ${horaReserva} · ${tipoServicio}`,
          url: '/negocio/dashboard',
        }
        console.log('[PATCH /api/reservaciones/[id]] Preparando push staff', {
          negocioId,
          staffIds,
          payload: payloadStaff,
        })
        await enviarPushAUsuarios(
          staffIds,
          payloadStaff
        )
      } else {
        console.log('[PATCH /api/reservaciones/[id]] No se encontraron staffIds para push', {
          negocioId,
        })
      }
    }

    await enviarEmailCancelacionReservaNegocio({
      email: negocioEmail,
      nombreUsuario: usuarioNombre,
      fecha: reserva.fecha,
      hora: horaReserva,
      tipoServicio,
      creditoDevuelto,
    })
  }

  return NextResponse.json({ success: true })
}
