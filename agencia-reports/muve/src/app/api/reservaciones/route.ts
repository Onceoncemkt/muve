import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { formatHora, type DiaSemana } from '@/types'
import { enviarPushAUsuarios, obtenerStaffIdsPorNegocio } from '@/lib/push/server'
import {
  PLAN_MAX_VISITAS_POR_LUGAR,
  PLAN_VISITAS_MENSUALES,
  normalizarPlan,
  puedeReservarConPlan,
} from '@/lib/planes'
import { planExpirado, resolverVentanaCiclo } from '@/lib/ciclos'
function diaSemanaDesdeFecha(fecha: string): DiaSemana | null {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return dias[date.getDay()]
}


function normalizarTextoOpcional(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

function faltaRelacion(error: { message?: string } | null | undefined, relation: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
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

// GET /api/reservaciones — reservaciones del usuario autenticado
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const now_ms = Date.now()
  const db = admin()

  const { data: dataJoin, error: errorJoin } = await db
    .from('reservaciones')
    .select(`
      id, fecha, estado, created_at, horario_id,
      horarios (
        id, dia_semana, hora_inicio, hora_fin, capacidad_total, tipo_clase, nombre_coach,
        negocios ( id, nombre, categoria, direccion )
      )
    `)
    .eq('user_id', user.id)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (!errorJoin) {
    const reservacionesJoin = (dataJoin ?? []).sort((a, b) => {
      const horarioA = Array.isArray(a.horarios) ? a.horarios[0] : a.horarios
      const horarioB = Array.isArray(b.horarios) ? b.horarios[0] : b.horarios
      const keyA = `${a.fecha}T${horarioA?.hora_inicio ?? '23:59:59'}`
      const keyB = `${b.fecha}T${horarioB?.hora_inicio ?? '23:59:59'}`
      return keyA.localeCompare(keyB)
    })
    return NextResponse.json({ reservaciones: reservacionesJoin, now_ms })
  }

  console.warn('[GET /api/reservaciones] fallback sin join', errorJoin)

  const { data: reservacionesBase, error: reservacionesBaseError } = await db
    .from('reservaciones')
    .select('id, fecha, estado, created_at, horario_id')
    .eq('user_id', user.id)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (reservacionesBaseError) {
    console.error('[GET /api/reservaciones] fallback base', reservacionesBaseError)
    return NextResponse.json({ error: reservacionesBaseError.message }, { status: 500 })
  }

  const horarioIds = Array.from(new Set(
    (reservacionesBase ?? [])
      .map((reserva) => reserva.horario_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  ))

  const horariosMap = new Map<string, {
    id: string
    dia_semana: string
    hora_inicio: string
    hora_fin: string
    capacidad_total: number | null
    tipo_clase: string | null
    nombre_coach: string | null
    negocios: { id: string; nombre: string; categoria: string | null; direccion: string | null } | null
  }>()

  if (horarioIds.length > 0) {
    const { data: horariosJoin, error: horariosJoinError } = await db
      .from('horarios')
      .select(`
        id, dia_semana, hora_inicio, hora_fin, capacidad_total, tipo_clase, nombre_coach, negocio_id,
        negocios ( id, nombre, categoria, direccion )
      `)
      .in('id', horarioIds)

    if (!horariosJoinError) {
      for (const horario of horariosJoin ?? []) {
        const negocio = Array.isArray(horario.negocios) ? horario.negocios[0] : horario.negocios
        horariosMap.set(horario.id, {
          id: horario.id,
          dia_semana: horario.dia_semana,
          hora_inicio: horario.hora_inicio,
          hora_fin: horario.hora_fin,
          capacidad_total: typeof horario.capacidad_total === 'number' ? horario.capacidad_total : null,
          tipo_clase: typeof horario.tipo_clase === 'string' ? horario.tipo_clase : null,
          nombre_coach: typeof horario.nombre_coach === 'string' ? horario.nombre_coach : null,
          negocios: negocio
            ? {
              id: negocio.id,
              nombre: negocio.nombre,
              categoria: typeof negocio.categoria === 'string' ? negocio.categoria : null,
              direccion: typeof negocio.direccion === 'string' ? negocio.direccion : null,
            }
            : null,
        })
      }
    } else {
      const { data: horariosBase, error: horariosBaseError } = await db
        .from('horarios')
        .select('id, dia_semana, hora_inicio, hora_fin, capacidad_total, tipo_clase, nombre_coach, negocio_id')
        .in('id', horarioIds)

      if (horariosBaseError) {
        console.error('[GET /api/reservaciones] fallback horarios', horariosBaseError)
        return NextResponse.json({ error: horariosBaseError.message }, { status: 500 })
      }

      const negocioIds = Array.from(new Set(
        (horariosBase ?? [])
          .map((horario) => horario.negocio_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ))

      const negociosMap = new Map<string, { id: string; nombre: string; categoria: string | null; direccion: string | null }>()
      if (negocioIds.length > 0) {
        const { data: negocios, error: negociosError } = await db
          .from('negocios')
          .select('id, nombre, categoria, direccion')
          .in('id', negocioIds)

        if (negociosError) {
          console.error('[GET /api/reservaciones] fallback negocios', negociosError)
          return NextResponse.json({ error: negociosError.message }, { status: 500 })
        }

        for (const negocio of negocios ?? []) {
          negociosMap.set(negocio.id, {
            id: negocio.id,
            nombre: negocio.nombre,
            categoria: typeof negocio.categoria === 'string' ? negocio.categoria : null,
            direccion: typeof negocio.direccion === 'string' ? negocio.direccion : null,
          })
        }
      }

      for (const horario of horariosBase ?? []) {
        const negocio = typeof horario.negocio_id === 'string' ? (negociosMap.get(horario.negocio_id) ?? null) : null
        horariosMap.set(horario.id, {
          id: horario.id,
          dia_semana: horario.dia_semana,
          hora_inicio: horario.hora_inicio,
          hora_fin: horario.hora_fin,
          capacidad_total: typeof horario.capacidad_total === 'number' ? horario.capacidad_total : null,
          tipo_clase: typeof horario.tipo_clase === 'string' ? horario.tipo_clase : null,
          nombre_coach: typeof horario.nombre_coach === 'string' ? horario.nombre_coach : null,
          negocios: negocio,
        })
      }
    }
  }

  const reservaciones = (reservacionesBase ?? [])
    .map((reserva) => ({
      ...reserva,
      horarios: typeof reserva.horario_id === 'string'
        ? (horariosMap.get(reserva.horario_id) ?? null)
        : null,
    }))
    .sort((a, b) => {
      const horarioA = Array.isArray(a.horarios) ? a.horarios[0] : a.horarios
      const horarioB = Array.isArray(b.horarios) ? b.horarios[0] : b.horarios
      const keyA = `${a.fecha}T${horarioA?.hora_inicio ?? '23:59:59'}`
      const keyB = `${b.fecha}T${horarioB?.hora_inicio ?? '23:59:59'}`
      return keyA.localeCompare(keyB)
    })

  return NextResponse.json({ reservaciones, now_ms, fallback: true })
}

// POST /api/reservaciones — crear reservación
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Debes iniciar sesión y activar un plan para reservar.' },
      { status: 401 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { horario_id, fecha, servicio_id } = body as { horario_id?: string; fecha?: string; servicio_id?: string }

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
  const fechaHoraInicio = new Date(`${fecha}T${horario.hora_inicio}`)
  if (!Number.isNaN(fechaHoraInicio.getTime()) && Date.now() >= fechaHoraInicio.getTime()) {
    return NextResponse.json(
      { error: 'Ya no puedes reservar esta clase. Las reservaciones cierran en punto de la hora de inicio.' },
      { status: 400 }
    )
  }

  const { data: negocioContexto, error: negocioContextoError } = await db
    .from('negocios')
    .select('nombre, categoria, nivel, plan_requerido')
    .eq('id', horario.negocio_id)
    .maybeSingle<{
      nombre: string
      categoria: string
      nivel?: 'basico' | 'plus' | 'total' | null
      plan_requerido?: 'basico' | 'plus' | 'total' | null
    }>()

  if (negocioContextoError || !negocioContexto) {
    return NextResponse.json({ error: 'No se pudo validar el negocio de la reservación' }, { status: 400 })
  }

  const esWellness = negocioContexto.categoria === 'estetica'
  let servicioReservado: { id: string; nombre: string; precio_normal_mxn: number } | null = null

  if (esWellness) {
    const servicioId = typeof servicio_id === 'string' ? servicio_id.trim() : ''
    if (!servicioId) {
      return NextResponse.json({ error: 'Selecciona un servicio para reservar tu visita wellness' }, { status: 400 })
    }

    const { data: servicio, error: servicioError } = await db
      .from('negocio_servicios')
      .select('id, nombre, precio_normal_mxn, activo')
      .eq('id', servicioId)
      .eq('negocio_id', horario.negocio_id)
      .maybeSingle<{ id: string; nombre: string; precio_normal_mxn: number; activo: boolean }>()

    if (faltaRelacion(servicioError, 'negocio_servicios')) {
      return NextResponse.json(
        { error: 'Falta la tabla negocio_servicios. Ejecuta la migración 017 en Supabase.' },
        { status: 500 }
      )
    }

    if (servicioError || !servicio || !servicio.activo) {
      return NextResponse.json({ error: 'Servicio wellness inválido o inactivo' }, { status: 400 })
    }

    servicioReservado = {
      id: servicio.id,
      nombre: servicio.nombre,
      precio_normal_mxn: Math.max(Math.trunc(servicio.precio_normal_mxn ?? 0), 0),
    }
  }

  const { data: perfilUsuario, error: perfilUsuarioError } = await db
    .from('users')
    .select('plan_activo, plan, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, reservas_suspendidas_hasta')
    .eq('id', user.id)
    .maybeSingle<{
      plan_activo: boolean
      plan: string | null
      fecha_inicio_ciclo: string | null
      fecha_fin_plan: string | null
      creditos_extra: number | null
      reservas_suspendidas_hasta: string | null
    }>()

  if (faltaColumna(perfilUsuarioError, 'fecha_inicio_ciclo')) {
    return NextResponse.json(
      { error: 'Falta la columna users.fecha_inicio_ciclo. Ejecuta la migración 019 en Supabase.' },
      { status: 500 }
    )
  }

  if (perfilUsuarioError) {
    if (faltaColumna(perfilUsuarioError, 'creditos_extra')) {
      return NextResponse.json(
        { error: 'Falta la columna users.creditos_extra. Ejecuta la migración 020 en Supabase.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: 'No se pudo validar tu membresía' }, { status: 500 })
  }

  if (!perfilUsuario?.plan_activo || !normalizarPlan(perfilUsuario.plan ?? null)) {
    return NextResponse.json({ error: 'Necesitas un plan activo para reservar.' }, { status: 403 })
  }
  if (perfilUsuario.reservas_suspendidas_hasta) {
    const fechaSuspension = new Date(perfilUsuario.reservas_suspendidas_hasta)
    if (!Number.isNaN(fechaSuspension.getTime()) && fechaSuspension.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: `Tu acceso a reservas está suspendido hasta ${fechaSuspension.toLocaleString('es-MX')}.`,
        },
        { status: 403 }
      )
    }
  }

  if (planExpirado(perfilUsuario.fecha_fin_plan)) {
    await db
      .from('users')
      .update({ plan_activo: false })
      .eq('id', user.id)
    return NextResponse.json({ error: 'Tu membresía está expirada' }, { status: 403 })
  }

  const planUsuario = normalizarPlan(perfilUsuario.plan ?? null) ?? 'basico'
  const nivelNegocio = negocioContexto.nivel === 'plus' || negocioContexto.nivel === 'total'
    ? negocioContexto.nivel
    : negocioContexto.plan_requerido === 'plus' || negocioContexto.plan_requerido === 'total'
      ? negocioContexto.plan_requerido
    : 'basico'
  if (!puedeReservarConPlan(planUsuario, nivelNegocio)) {
    return NextResponse.json(
      { error: nivelNegocio === 'plus' ? 'Este lugar requiere plan Plus' : 'Este lugar requiere plan Total' },
      { status: 403 }
    )
  }
  const ciclo = resolverVentanaCiclo({
    fechaInicioCiclo: perfilUsuario.fecha_inicio_ciclo,
    fechaFinPlan: perfilUsuario.fecha_fin_plan,
  })

  if (!perfilUsuario.fecha_inicio_ciclo || !perfilUsuario.fecha_fin_plan) {
    const actualizacionCiclo: Record<string, string> = {}
    if (!perfilUsuario.fecha_inicio_ciclo) {
      actualizacionCiclo.fecha_inicio_ciclo = ciclo.inicio.toISOString()
    }
    if (!perfilUsuario.fecha_fin_plan) {
      actualizacionCiclo.fecha_fin_plan = ciclo.fin.toISOString()
    }
    if (Object.keys(actualizacionCiclo).length > 0) {
      await db
        .from('users')
        .update(actualizacionCiclo)
        .eq('id', user.id)
    }
  }

  const [{ count: visitasCiclo, error: visitasCicloError }, { count: visitasLugarCiclo, error: visitasLugarCicloError }] = await Promise.all([
    db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('fecha', ciclo.inicio.toISOString())
      .lt('fecha', ciclo.fin.toISOString()),
    db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('negocio_id', horario.negocio_id)
      .gte('fecha', ciclo.inicio.toISOString())
      .lt('fecha', ciclo.fin.toISOString()),
  ])

  if (visitasCicloError || visitasLugarCicloError) {
    return NextResponse.json({ error: 'No se pudieron validar tus límites de visitas' }, { status: 500 })
  }

  const limiteMensual = PLAN_VISITAS_MENSUALES[planUsuario]
  const creditosExtra = Math.max(Math.trunc(perfilUsuario.creditos_extra ?? 0), 0)
  const visitasDisponibles = limiteMensual + creditosExtra
  if ((visitasCiclo ?? 0) >= visitasDisponibles) {
    return NextResponse.json(
      { error: `Ya alcanzaste tu límite del ciclo actual de ${visitasDisponibles} visitas` },
      { status: 400 }
    )
  }

  const limitePorLugar = PLAN_MAX_VISITAS_POR_LUGAR[planUsuario]
  if ((visitasLugarCiclo ?? 0) >= limitePorLugar) {
    return NextResponse.json(
      { error: `Ya alcanzaste tu límite de ${limitePorLugar} visitas en este lugar durante este ciclo` },
      { status: 400 }
    )
  }
  const { data: reservacionExistente, error: reservacionExistenteError } = await db
    .from('reservaciones')
    .select('id')
    .eq('user_id', user.id)
    .eq('horario_id', horario_id)
    .eq('fecha', fecha)
    .eq('estado', 'confirmada')
    .limit(1)

  if (reservacionExistenteError) {
    return NextResponse.json({ error: 'No se pudo validar si ya existe la reservación' }, { status: 500 })
  }

  if ((reservacionExistente ?? []).length > 0) {
    return NextResponse.json({ error: 'Ya tienes una reservación en este horario' }, { status: 409 })
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
    .insert({
      user_id: user.id,
      horario_id,
      fecha,
      estado: 'confirmada',
      servicio_id: servicioReservado?.id ?? null,
      servicio_nombre: servicioReservado?.nombre ?? null,
      servicio_precio_normal_mxn: servicioReservado?.precio_normal_mxn ?? null,
    })
    .select('id, fecha, estado')
    .single()

  if (iError) {
    if (
      faltaColumna(iError, 'servicio_id')
      || faltaColumna(iError, 'servicio_nombre')
      || faltaColumna(iError, 'servicio_precio_normal_mxn')
    ) {
      return NextResponse.json(
        { error: 'Faltan columnas de servicio en reservaciones. Ejecuta la migración 017 en Supabase.' },
        { status: 500 }
      )
    }
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
