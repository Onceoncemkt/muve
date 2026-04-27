import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  calcularMontoNegocioPorVisita,
  PLAN_MAX_VISITAS_POR_LUGAR,
  PLAN_VISITAS_MENSUALES,
  normalizarPlan,
} from '@/lib/planes'
import { planExpirado, resolverVentanaCiclo } from '@/lib/ciclos'

export async function POST(request: NextRequest) {
  const authClient = await createClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = createServiceClient()

  function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() ?? ''
    return message.includes('column') && message.includes('negocio_id')
  }

  function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
    const message = error?.message?.toLowerCase() ?? ''
    return message.includes('column') && message.includes(columna.toLowerCase())
  }

  // Verificar que sea staff o admin
  let perfil: { rol: string; nombre: string | null; negocio_id: string | null } | null = null
  const consultaPerfil = await db
    .from('users')
    .select('rol, nombre, negocio_id')
    .eq('id', user.id)
    .single<{ rol: string; nombre: string | null; negocio_id: string | null }>()

  if (!consultaPerfil.error && consultaPerfil.data) {
    perfil = consultaPerfil.data
  } else if (faltaColumnaNegocioId(consultaPerfil.error)) {
    const fallback = await db
      .from('users')
      .select('rol, nombre')
      .eq('id', user.id)
      .single<{ rol: string; nombre: string | null }>()
    if (!fallback.error && fallback.data) {
      perfil = { ...fallback.data, negocio_id: null }
    }
  }

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : ''
  if (!token) {
    return NextResponse.json({ error: 'Falta token' }, { status: 400 })
  }

  if (
    perfil.rol === 'staff'
    && perfil.negocio_id
    && negocioIdBody
    && negocioIdBody !== perfil.negocio_id
  ) {
    return NextResponse.json(
      { error: 'No puedes validar visitas de otro negocio' },
      { status: 403 }
    )
  }

  const negocioIdObjetivo = perfil.rol === 'staff' ? (perfil.negocio_id ?? '') : negocioIdBody
  if (!negocioIdObjetivo) {
    return NextResponse.json(
      {
        error: perfil.rol === 'staff'
          ? 'Tu cuenta no tiene negocio asignado'
          : 'Falta negocio_id',
      },
      { status: 400 }
    )
  }

  const tokenNormalizado = token.toLowerCase()
  const { data: usuarioPorHash, error: usuarioPorHashError } = await db
    .rpc('buscar_usuario_por_qr_hash', { p_hash: tokenNormalizado })
    .maybeSingle<{
      user_id: string
      nombre: string
      ciudad: string
      plan_activo: boolean
      plan?: unknown
      fecha_inicio_ciclo?: string | null
      fecha_fin_plan?: string | null
      creditos_extra?: number | null
    }>()

  if (usuarioPorHashError) {
    const message = usuarioPorHashError.message?.toLowerCase() ?? ''
    if (message.includes('buscar_usuario_por_qr_hash')) {
      return NextResponse.json(
        { error: 'Falta la función buscar_usuario_por_qr_hash. Ejecuta la migración 024 en Supabase.' },
        { status: 500 }
      )
    }
    if (faltaColumna(usuarioPorHashError, 'fecha_inicio_ciclo')) {
      return NextResponse.json(
        { error: 'Falta la columna users.fecha_inicio_ciclo. Ejecuta la migración 019 en Supabase.' },
        { status: 500 }
      )
    }
    if (faltaColumna(usuarioPorHashError, 'creditos_extra')) {
      return NextResponse.json(
        { error: 'Falta la columna users.creditos_extra. Ejecuta la migración 020 en Supabase.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: 'No se pudo validar el pase del usuario' }, { status: 500 })
  }

  if (!usuarioPorHash) {
    return NextResponse.json({ valido: false, error: 'Token no encontrado' }, { status: 404 })
  }

  const usuarioId = usuarioPorHash.user_id
  const usuario = {
    nombre: usuarioPorHash.nombre,
    ciudad: usuarioPorHash.ciudad,
    plan_activo: usuarioPorHash.plan_activo,
    plan: usuarioPorHash.plan,
    fecha_inicio_ciclo: usuarioPorHash.fecha_inicio_ciclo,
    fecha_fin_plan: usuarioPorHash.fecha_fin_plan,
    creditos_extra: usuarioPorHash.creditos_extra,
  }
  const planUsuario = normalizarPlan(usuario?.plan ?? null) ?? 'basico'

  if (!usuario?.plan_activo) {
    return NextResponse.json({ valido: false, error: 'Usuario sin membresía activa' })
  }

  if (planExpirado(usuario.fecha_fin_plan)) {
    await db
      .from('users')
      .update({ plan_activo: false })
      .eq('id', usuarioId)

    return NextResponse.json({ valido: false, error: 'Membresía expirada' })
  }

  const ciclo = resolverVentanaCiclo({
    fechaInicioCiclo: usuario.fecha_inicio_ciclo,
    fechaFinPlan: usuario.fecha_fin_plan,
  })

  if (!usuario.fecha_inicio_ciclo || !usuario.fecha_fin_plan) {
    const actualizacionCiclo: Record<string, string> = {}
    if (!usuario.fecha_inicio_ciclo) {
      actualizacionCiclo.fecha_inicio_ciclo = ciclo.inicio.toISOString()
    }
    if (!usuario.fecha_fin_plan) {
      actualizacionCiclo.fecha_fin_plan = ciclo.fin.toISOString()
    }
    if (Object.keys(actualizacionCiclo).length > 0) {
      await db
        .from('users')
        .update(actualizacionCiclo)
        .eq('id', usuarioId)
    }
  }

  const [{ count: visitasCiclo, error: visitasCicloError }, { count: visitasLugarCiclo, error: visitasLugarCicloError }] = await Promise.all([
    db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', usuarioId)
      .gte('fecha', ciclo.inicio.toISOString())
      .lt('fecha', ciclo.fin.toISOString()),
    db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', usuarioId)
      .eq('negocio_id', negocioIdObjetivo)
      .gte('fecha', ciclo.inicio.toISOString())
      .lt('fecha', ciclo.fin.toISOString()),
  ])

  if (visitasCicloError || visitasLugarCicloError) {
    return NextResponse.json({ error: 'No se pudieron validar límites de visitas' }, { status: 500 })
  }

  const limiteMensual = PLAN_VISITAS_MENSUALES[planUsuario]
  const creditosExtra = Math.max(Math.trunc(usuario.creditos_extra ?? 0), 0)
  const visitasDisponibles = limiteMensual + creditosExtra
  if ((visitasCiclo ?? 0) >= visitasDisponibles) {
    return NextResponse.json({ valido: false, error: 'Usuario agotó sus visitas del ciclo actual' })
  }

  const limitePorLugar = PLAN_MAX_VISITAS_POR_LUGAR[planUsuario]
  if ((visitasLugarCiclo ?? 0) >= limitePorLugar) {
    return NextResponse.json({
      valido: false,
      error: 'Límite de visitas en este lugar alcanzado',
    })
  }
  let negocio: {
    nombre: string
    categoria: string | null
    monto_maximo_visita: number | null
    requiere_reserva: boolean
  } | null = null
  const consultaNegocio = await db
    .from('negocios')
    .select('nombre, categoria, monto_maximo_visita, requiere_reserva')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<{
      nombre: string
      categoria: string | null
      monto_maximo_visita: number | null
      requiere_reserva: boolean
    }>()

  if (!consultaNegocio.error && consultaNegocio.data) {
    negocio = consultaNegocio.data
  } else if (
    faltaColumna(consultaNegocio.error, 'monto_maximo_visita')
    || faltaColumna(consultaNegocio.error, 'requiere_reserva')
  ) {
    const faltaMontoMaximoVisita = faltaColumna(consultaNegocio.error, 'monto_maximo_visita')
    const faltaRequiereReserva = faltaColumna(consultaNegocio.error, 'requiere_reserva')
    const columnasFallback = ['nombre', 'categoria']
    if (!faltaMontoMaximoVisita) {
      columnasFallback.push('monto_maximo_visita')
    }
    if (!faltaRequiereReserva) {
      columnasFallback.push('requiere_reserva')
    }
    const fallbackNegocio = await db
      .from('negocios')
      .select(columnasFallback.join(', '))
      .eq('id', negocioIdObjetivo)
      .maybeSingle<{
        nombre: string
        categoria: string | null
        monto_maximo_visita?: number | null
        requiere_reserva?: boolean
      }>()
    if (!fallbackNegocio.error && fallbackNegocio.data) {
      const categoriaFallback = typeof fallbackNegocio.data.categoria === 'string'
        ? fallbackNegocio.data.categoria
        : null
      negocio = {
        ...fallbackNegocio.data,
        monto_maximo_visita: typeof fallbackNegocio.data.monto_maximo_visita === 'number'
          ? fallbackNegocio.data.monto_maximo_visita
          : null,
        requiere_reserva: typeof fallbackNegocio.data.requiere_reserva === 'boolean'
          ? fallbackNegocio.data.requiere_reserva
          : categoriaFallback !== 'restaurante',
      }
    }
  }

  if (!negocio) {
    return NextResponse.json({ error: 'No se pudo validar el negocio' }, { status: 400 })
  }

  const categoriaNegocio = typeof negocio.categoria === 'string' ? negocio.categoria : null
  const montoNegocioMxn = calcularMontoNegocioPorVisita({
    categoria: categoriaNegocio,
    planUsuario,
  })
  const montoMaximoAutorizadoMxn = categoriaNegocio === 'restaurante'
    ? Math.max(Math.trunc(negocio.monto_maximo_visita ?? 0), 0)
    : null
  const hoy = new Date().toISOString().split('T')[0]
  const permiteVisitaDirecta = categoriaNegocio === 'restaurante' && !negocio.requiere_reserva
  let reservacionACompletarId: string | null = null

  let servicioReservado: { id: string; nombre: string; precio_normal_mxn: number | null; fecha: string } | null = null
  const { data: horariosNegocio, error: horariosError } = await db
    .from('horarios')
    .select('id')
    .eq('negocio_id', negocioIdObjetivo)

  if (horariosError) {
    return NextResponse.json({ error: 'No se pudieron validar los horarios del negocio' }, { status: 500 })
  }

  const horarioIds = Array.isArray(horariosNegocio)
    ? horariosNegocio.map((item) => item.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  if (horarioIds.length === 0 && !permiteVisitaDirecta) {
    return NextResponse.json(
      {
        valido: false,
        error: categoriaNegocio === 'estetica'
          ? 'Este negocio wellness no tiene horarios configurados'
          : 'Este negocio requiere reservación para validar visitas',
      },
      { status: 400 }
    )
  }

  if (horarioIds.length > 0) {
    if (categoriaNegocio === 'estetica') {
      const { data: reservacionWellness, error: reservacionWellnessError } = await db
        .from('reservaciones')
        .select('id, fecha, servicio_id, servicio_nombre, servicio_precio_normal_mxn, created_at')
        .eq('user_id', usuarioId)
        .eq('estado', 'confirmada')
        .eq('fecha', hoy)
        .in('horario_id', horarioIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string
          fecha: string
          servicio_id: string | null
          servicio_nombre: string | null
          servicio_precio_normal_mxn: number | null
          created_at: string
        }>()

      if (
        faltaColumna(reservacionWellnessError, 'servicio_id')
        || faltaColumna(reservacionWellnessError, 'servicio_nombre')
        || faltaColumna(reservacionWellnessError, 'servicio_precio_normal_mxn')
      ) {
        return NextResponse.json(
          { error: 'Faltan columnas de servicio en reservaciones. Ejecuta la migración 017 en Supabase.' },
          { status: 500 }
        )
      }

      if (reservacionWellnessError) {
        return NextResponse.json({ error: 'No se pudo validar la reservación wellness' }, { status: 500 })
      }

      if (reservacionWellness && reservacionWellness.servicio_nombre) {
        reservacionACompletarId = reservacionWellness.id
        servicioReservado = {
          id: reservacionWellness.servicio_id ?? reservacionWellness.id,
          nombre: reservacionWellness.servicio_nombre,
          precio_normal_mxn: reservacionWellness.servicio_precio_normal_mxn,
          fecha: reservacionWellness.fecha,
        }
      }
    } else {
      const { data: reservacionConfirmada, error: reservacionConfirmadaError } = await db
        .from('reservaciones')
        .select('id, fecha, created_at')
        .eq('user_id', usuarioId)
        .eq('estado', 'confirmada')
        .eq('fecha', hoy)
        .in('horario_id', horarioIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; fecha: string; created_at: string }>()

      if (reservacionConfirmadaError) {
        return NextResponse.json({ error: 'No se pudo validar la reservación del usuario' }, { status: 500 })
      }

      if (reservacionConfirmada) {
        reservacionACompletarId = reservacionConfirmada.id
      }
    }
  }

  if (!reservacionACompletarId && !permiteVisitaDirecta) {
    return NextResponse.json(
      {
        valido: false,
        error: categoriaNegocio === 'estetica'
          ? 'No hay servicio wellness reservado para hoy en este negocio'
          : 'No hay reservación confirmada para hoy en este negocio',
      },
      { status: 400 }
    )
  }

  // Registrar visita y actualizar último check-in
  const payloadVisita = {
    user_id: usuarioId,
    negocio_id: negocioIdObjetivo,
    fecha: new Date().toISOString(),
    validado_por: perfil.nombre,
    plan_usuario: planUsuario,
  }

  let visitaError: { message?: string } | null = null
  const insercionConMonto = await db
    .from('visitas')
    .insert({
      ...payloadVisita,
      monto_negocio: montoNegocioMxn,
    })

  if (faltaColumna(insercionConMonto.error, 'monto_negocio')) {
    const insercionFallback = await db
      .from('visitas')
      .insert(payloadVisita)
    visitaError = insercionFallback.error
  } else {
    visitaError = insercionConMonto.error
  }

  if (visitaError) {
    return NextResponse.json({ error: 'Error al registrar visita' }, { status: 500 })
  }

  if (reservacionACompletarId) {
    const { error: completarReservacionError } = await db
      .from('reservaciones')
      .update({ estado: 'completada' })
      .eq('id', reservacionACompletarId)
      .eq('user_id', usuarioId)
      .eq('estado', 'confirmada')
      .in('horario_id', horarioIds)

    if (completarReservacionError) {
      console.warn('[POST /api/validar] No se pudo completar la reservación', completarReservacionError)
    }
  }

  const { error: ultimoCheckinError } = await db
    .from('users')
    .update({ ultimo_checkin: new Date().toISOString() })
    .eq('id', usuarioId)
  if (ultimoCheckinError && !faltaColumna(ultimoCheckinError, 'ultimo_checkin')) {
    console.warn('[POST /api/validar] No se pudo actualizar ultimo_checkin', ultimoCheckinError)
  }

  const visitasUsadasCiclo = (visitasCiclo ?? 0) + 1
  const visitasRestantesCiclo = Math.max(visitasDisponibles - visitasUsadasCiclo, 0)

  return NextResponse.json({
    valido: true,
    usuario: usuario.nombre,
    negocio: negocio.nombre,
    categoria_negocio: categoriaNegocio,
    servicio_reservado: servicioReservado,
    monto_negocio_mxn: montoNegocioMxn,
    monto_maximo_autorizado_mxn: montoMaximoAutorizadoMxn,
    visitas_restantes_mes: visitasRestantesCiclo,
    visitas_usadas_mes: visitasUsadasCiclo,
    limite_visitas_mensuales: limiteMensual,
    visitas_disponibles: visitasDisponibles,
    visitas_restantes_ciclo: visitasRestantesCiclo,
    visitas_usadas_ciclo: visitasUsadasCiclo,
    ciclo_inicio: ciclo.inicio.toISOString(),
    ciclo_fin: ciclo.fin.toISOString(),
  })
}
