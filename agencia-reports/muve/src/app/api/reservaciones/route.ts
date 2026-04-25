import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { DiaSemana } from '@/types'
import { enviarPushAUsuarios, obtenerStaffIdsPorNegocio } from '@/lib/push/server'
function diaSemanaDesdeFecha(fecha: string): DiaSemana | null {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return dias[date.getDay()]
}

function formatHora(hora: string) {
  return hora.slice(0, 5)
}

function normalizarTextoOpcional(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

function detalleHorario(tipoClase: string | null, nombreCoach: string | null) {
  const partes: string[] = []
  if (tipoClase) partes.push(`Clase: ${tipoClase}`)
  if (nombreCoach) partes.push(`Coach: ${nombreCoach}`)
  return partes.length > 0 ? partes.join(' · ') : null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plantillaConfirmacionReserva({
  nombreUsuario,
  negocioNombre,
  fecha,
  hora,
  tipoClase,
  nombreCoach,
}: {
  nombreUsuario: string
  negocioNombre: string
  fecha: string
  hora: string
  tipoClase: string | null
  nombreCoach: string | null
}) {
  const nombreSeguro = escapeHtml(nombreUsuario)
  const negocioSeguro = escapeHtml(negocioNombre)
  const fechaSegura = escapeHtml(fecha)
  const horaSegura = escapeHtml(hora)
  const tipoClaseSeguro = tipoClase ? escapeHtml(tipoClase) : null
  const nombreCoachSeguro = nombreCoach ? escapeHtml(nombreCoach) : null

  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0A0A0A; color: #ffffff; padding: 24px;">
      <div style="max-width: 520px; margin: 0 auto; border: 1px solid #1f1f1f; border-radius: 12px; padding: 24px;">
        <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #9ca3af; margin: 0 0 16px;">MUVET</p>
        <h1 style="font-size: 28px; line-height: 1.2; margin: 0 0 16px;">Reservación confirmada</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0 0 10px;">
          Hola ${nombreSeguro}, tu reservación en <strong>${negocioSeguro}</strong> está confirmada.
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin: 0;">
          Fecha: <strong>${fechaSegura}</strong><br />
          Hora: <strong>${horaSegura}</strong>
          ${tipoClaseSeguro ? `<br />Tipo de clase: <strong>${tipoClaseSeguro}</strong>` : ''}
          ${nombreCoachSeguro ? `<br />Coach: <strong>${nombreCoachSeguro}</strong>` : ''}
        </p>
      </div>
    </div>
  `
}

async function enviarEmailConfirmacionReserva({
  email,
  nombreUsuario,
  negocioNombre,
  fecha,
  hora,
  tipoClase,
  nombreCoach,
}: {
  email: string | null
  nombreUsuario: string
  negocioNombre: string
  fecha: string
  hora: string
  tipoClase: string | null
  nombreCoach: string | null
}) {
  if (!email) return

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM
  if (!resendApiKey || !fromEmail) return

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
        subject: 'Confirmación de reservación — MUVET',
        html: plantillaConfirmacionReserva({
          nombreUsuario,
          negocioNombre,
          fecha,
          hora,
          tipoClase,
          nombreCoach,
        }),
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      console.warn('[POST /api/reservaciones] No se pudo enviar email de confirmación', payload)
    }
  } catch (error) {
    console.warn('[POST /api/reservaciones] Error enviando email de confirmación', error)
  }
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/reservaciones — próximas reservaciones del usuario autenticado
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hoy = new Date().toISOString().split('T')[0]
  const now_ms = Date.now()

  const { data, error } = await admin()
    .from('reservaciones')
    .select(`
      id, fecha, estado, created_at,
      horarios (
        id, dia_semana, hora_inicio, hora_fin, capacidad_total,
        negocios ( id, nombre, direccion )
      )
    `)
    .eq('user_id', user.id)
    .gte('fecha', hoy)
    .order('fecha', { ascending: true })
    .order('horarios(hora_inicio)', { ascending: true })

  if (error) {
    console.error('[GET /api/reservaciones]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reservaciones: data, now_ms })
}

// POST /api/reservaciones — crear reservación
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { horario_id, fecha } = body as { horario_id?: string; fecha?: string }

  if (!horario_id || !fecha) {
    return NextResponse.json({ error: 'horario_id y fecha son requeridos' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' }, { status: 400 })
  }

  const diaSolicitado = diaSemanaDesdeFecha(fecha)
  if (!diaSolicitado) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const hoy = new Date().toISOString().split('T')[0]
  if (fecha < hoy) {
    return NextResponse.json({ error: 'No puedes reservar fechas pasadas' }, { status: 400 })
  }

  const db = admin()

  // Verificar que el horario existe y está activo
  const { data: horario, error: hError } = await db
    .from('horarios')
    .select('id, capacidad_total, activo, dia_semana, hora_inicio, negocio_id, nombre_coach, tipo_clase')
    .eq('id', horario_id)
    .single()

  if (hError || !horario) {
    return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 })
  }
  if (!horario.activo) {
    return NextResponse.json({ error: 'Horario no disponible' }, { status: 400 })
  }
  if (horario.dia_semana !== diaSolicitado) {
    return NextResponse.json(
      { error: 'Este horario no corresponde al día seleccionado' },
      { status: 400 }
    )
  }

  // Verificar spots disponibles
  const { count } = await db
    .from('reservaciones')
    .select('id', { count: 'exact', head: true })
    .eq('horario_id', horario_id)
    .eq('fecha', fecha)
    .eq('estado', 'confirmada')

  if ((count ?? 0) >= horario.capacidad_total) {
    return NextResponse.json({ error: 'No hay spots disponibles' }, { status: 409 })
  }

  // Crear reservación
  const { data: nueva, error: iError } = await db
    .from('reservaciones')
    .insert({ user_id: user.id, horario_id, fecha, estado: 'confirmada' })
    .select('id, fecha, estado')
    .single()

  if (iError) {
    if (iError.code === '23505') {
      return NextResponse.json({ error: 'Ya tienes una reservación en este horario' }, { status: 409 })
    }
    console.error('[POST /api/reservaciones]', iError)
    return NextResponse.json({ error: iError.message }, { status: 500 })
  }

  const [negocioData, usuarioData] = await Promise.all([
    typeof horario.negocio_id === 'string'
      ? db
        .from('negocios')
        .select('nombre')
        .eq('id', horario.negocio_id)
        .maybeSingle<{ nombre: string }>()
      : Promise.resolve({ data: null, error: null }),
    db
      .from('users')
      .select('nombre, email')
      .eq('id', user.id)
      .maybeSingle<{ nombre: string; email: string | null }>(),
  ])

  const negocioNombre = negocioData.data?.nombre ?? 'negocio'
  const usuarioNombre = usuarioData.data?.nombre ?? user.email?.split('@')[0] ?? 'Usuario'
  const usuarioEmail = usuarioData.data?.email ?? user.email ?? null
  const hora = formatHora(horario.hora_inicio)
  const nombreCoach = normalizarTextoOpcional((horario as { nombre_coach?: unknown }).nombre_coach)
  const tipoClase = normalizarTextoOpcional((horario as { tipo_clase?: unknown }).tipo_clase)
  const detalle = detalleHorario(tipoClase, nombreCoach)

  await enviarPushAUsuarios(
    [user.id],
    {
      title: 'MUVET',
      body: `Reservación confirmada en ${negocioNombre} — ${fecha} a las ${hora}${detalle ? ` · ${detalle}` : ''}`,
      url: '/historial',
    }
  )

  if (typeof horario.negocio_id === 'string') {
    const staffIds = await obtenerStaffIdsPorNegocio(horario.negocio_id)
    if (staffIds.length > 0) {
      await enviarPushAUsuarios(
        staffIds,
        {
          title: 'MUVET',
          body: `Nueva reservación de ${usuarioNombre} para ${fecha} a las ${hora}${detalle ? ` · ${detalle}` : ''}`,
          url: '/negocio/dashboard',
        }
      )
    }
  }

  await enviarEmailConfirmacionReserva({
    email: usuarioEmail,
    nombreUsuario: usuarioNombre,
    negocioNombre,
    fecha,
    hora,
    tipoClase,
    nombreCoach,
  })

  return NextResponse.json({ reservacion: nueva }, { status: 201 })
}
