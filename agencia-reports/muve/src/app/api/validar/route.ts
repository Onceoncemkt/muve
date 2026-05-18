import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  PLAN_MAX_VISITAS_POR_LUGAR,
  PLAN_VISITAS_MENSUALES,
  calcularMontoNegocioPorVisita,
  normalizarCategoriasNegocio,
  normalizarPlan,
  resolverZonaNegocio,
  tarifaNegocioPorCheckin,
  zonaPorCiudad,
} from '@/lib/planes'
import { planExpirado, resolverVentanaCiclo } from '@/lib/ciclos'
import { getValidadorSession } from '@/lib/validador-auth'
import { notificarActualizacionWallet } from '@/lib/wallet/notificar-actualizacion'

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const validadorSession = await getValidadorSession()

  const db = createServiceClient()

  function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() ?? ''
    return message.includes('column') && message.includes('negocio_id')
  }

  function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
    const message = error?.message?.toLowerCase() ?? ''
    return message.includes('column') && message.includes(columna.toLowerCase())
  }

  let perfil: { rol: 'staff' | 'admin' | 'validador'; nombre: string | null; negocio_id: string | null } | null = null
  let validadorId: string | null = null

  if (validadorSession) {
    perfil = {
      rol: 'validador',
      nombre: validadorSession.nombre,
      negocio_id: validadorSession.negocio_id,
    }
    validadorId = validadorSession.validador_id
  } else {
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const consultaPerfil = await db
      .from('users')
      .select('rol, nombre, negocio_id')
      .eq('id', user.id)
      .single<{ rol: string; nombre: string | null; negocio_id: string | null }>()

    if (!consultaPerfil.error && consultaPerfil.data && (consultaPerfil.data.rol === 'staff' || consultaPerfil.data.rol === 'admin')) {
      perfil = {
        rol: consultaPerfil.data.rol,
        nombre: consultaPerfil.data.nombre,
        negocio_id: consultaPerfil.data.negocio_id,
      }
    } else if (faltaColumnaNegocioId(consultaPerfil.error)) {
      const fallback = await db
        .from('users')
        .select('rol, nombre')
        .eq('id', user.id)
        .single<{ rol: string; nombre: string | null }>()
      if (!fallback.error && fallback.data && (fallback.data.rol === 'staff' || fallback.data.rol === 'admin')) {
        perfil = {
          rol: fallback.data.rol,
          nombre: fallback.data.nombre,
          negocio_id: null,
        }
      }
    }
  }


  if (!perfil || !['staff', 'admin', 'validador'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const userIdBody = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : ''
  const soloCotizar = body.solo_cotizar === true
  const tipoServicioBody: 'gym' | 'clase' | null = body.tipo_servicio === 'gym' || body.tipo_servicio === 'clase'
    ? body.tipo_servicio
    : null
  if (!token && !userIdBody) {
    return NextResponse.json({ error: 'Falta token o user_id' }, { status: 400 })
  }

  if (
    perfil.rol === 'staff'
    && perfil.negocio_id
    && negocioIdBody
    && negocioIdBody !== perfil.negocio_id
  ) {
    return NextResponse.json(
      { error: 'No puedes validar créditos de otro negocio' },
      { status: 403 }
    )
  }

  const negocioIdObjetivo = perfil.rol === 'validador'
    ? (perfil.negocio_id ?? '')
    : (perfil.rol === 'staff' ? (perfil.negocio_id ?? '') : negocioIdBody)
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

  let usuarioId = ''
  let usuario: {
    nombre: string
    ciudad: string
    plan_activo: boolean
    plan?: unknown
    fecha_inicio_ciclo?: string | null
    fecha_fin_plan?: string | null
    creditos_extra?: number | null
  } | null = null

  if (token) {
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

    usuarioId = usuarioPorHash.user_id
    usuario = {
      nombre: usuarioPorHash.nombre,
      ciudad: usuarioPorHash.ciudad,
      plan_activo: usuarioPorHash.plan_activo,
      plan: usuarioPorHash.plan,
      fecha_inicio_ciclo: usuarioPorHash.fecha_inicio_ciclo,
      fecha_fin_plan: usuarioPorHash.fecha_fin_plan,
      creditos_extra: usuarioPorHash.creditos_extra,
    }
  } else {
    const { data: usuarioDirecto, error: usuarioDirectoError } = await db
      .from('users')
      .select('id, nombre, ciudad, plan_activo, plan, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, rol')
      .eq('id', userIdBody)
      .single<{
        id: string
        nombre: string
        ciudad: string
        plan_activo: boolean
        plan: string | null
        fecha_inicio_ciclo: string | null
        fecha_fin_plan: string | null
        creditos_extra: number | null
        rol: string
      }>()

    if (usuarioDirectoError || !usuarioDirecto || usuarioDirecto.rol !== 'usuario') {
      return NextResponse.json({ valido: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    usuarioId = usuarioDirecto.id
    usuario = {
      nombre: usuarioDirecto.nombre,
      ciudad: usuarioDirecto.ciudad,
      plan_activo: usuarioDirecto.plan_activo,
      plan: usuarioDirecto.plan,
      fecha_inicio_ciclo: usuarioDirecto.fecha_inicio_ciclo,
      fecha_fin_plan: usuarioDirecto.fecha_fin_plan,
      creditos_extra: usuarioDirecto.creditos_extra,
    }
  }
  if (!usuario) {
    return NextResponse.json({ valido: false, error: 'Usuario no encontrado' }, { status: 404 })
  }
  const planUsuario = normalizarPlan(usuario?.plan ?? null) ?? 'basico'
  const zonaUsuario = zonaPorCiudad(usuario.ciudad)

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
    return NextResponse.json({ error: 'No se pudieron validar límites de créditos' }, { status: 500 })
  }

  const limiteMensual = PLAN_VISITAS_MENSUALES[planUsuario]
  const creditosExtra = Math.max(Math.trunc(usuario.creditos_extra ?? 0), 0)
  const visitasDisponibles = limiteMensual + creditosExtra
  const limitePorLugar = PLAN_MAX_VISITAS_POR_LUGAR[planUsuario]
  let negocio: {
    nombre: string
    categoria: string | null
    categorias?: string[] | null
    nivel: 'basico' | 'plus' | 'total'
    plan_negocio: 'basico' | 'plus' | 'total'
    ciudad: string | null
    zona: string | null
    monto_maximo_visita: number | null
    requiere_reserva: boolean
  } | null = null
  const consultaNegocio = await db
    .from('negocios')
    .select('nombre, categoria, categorias, nivel, plan_negocio, ciudad, zona, monto_maximo_visita, requiere_reserva')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<{
      nombre: string
      categoria: string | null
      categorias?: string[] | null
      nivel?: 'basico' | 'plus' | 'total' | null
      plan_negocio?: 'basico' | 'plus' | 'total' | null
      ciudad: string | null
      zona: string | null
      monto_maximo_visita: number | null
      requiere_reserva: boolean
    }>()

  if (!consultaNegocio.error && consultaNegocio.data) {
    negocio = {
      ...consultaNegocio.data,
      nivel: consultaNegocio.data.nivel === 'plus' || consultaNegocio.data.nivel === 'total'
        ? consultaNegocio.data.nivel
        : 'basico',
      plan_negocio: consultaNegocio.data.plan_negocio === 'plus' || consultaNegocio.data.plan_negocio === 'total'
        ? consultaNegocio.data.plan_negocio
        : 'basico',
    }
  } else if (
    faltaColumna(consultaNegocio.error, 'zona')
    || faltaColumna(consultaNegocio.error, 'ciudad')
    || faltaColumna(consultaNegocio.error, 'monto_maximo_visita')
    || faltaColumna(consultaNegocio.error, 'requiere_reserva')
    || faltaColumna(consultaNegocio.error, 'plan_negocio')
  ) {
    const faltaMontoMaximoVisita = faltaColumna(consultaNegocio.error, 'monto_maximo_visita')
    const faltaRequiereReserva = faltaColumna(consultaNegocio.error, 'requiere_reserva')
    const faltaPlanNegocio = faltaColumna(consultaNegocio.error, 'plan_negocio')
    const columnasFallback = ['nombre', 'categoria', 'ciudad']
    if (!faltaColumna(consultaNegocio.error, 'categorias')) {
      columnasFallback.push('categorias')
    }
    if (!faltaColumna(consultaNegocio.error, 'zona')) {
      columnasFallback.push('zona')
    }
    if (!faltaMontoMaximoVisita) {
      columnasFallback.push('monto_maximo_visita')
    }
    if (!faltaRequiereReserva) {
      columnasFallback.push('requiere_reserva')
    }
    if (!faltaPlanNegocio) {
      columnasFallback.push('plan_negocio')
    }
    const fallbackNegocio = await db
      .from('negocios')
      .select(columnasFallback.join(', '))
      .eq('id', negocioIdObjetivo)
      .maybeSingle<{
        nombre: string
        categoria: string | null
        categorias?: string[] | null
        nivel?: 'basico' | 'plus' | 'total' | null
        plan_negocio?: 'basico' | 'plus' | 'total' | null
        ciudad?: string | null
        zona?: string | null
        monto_maximo_visita?: number | null
        requiere_reserva?: boolean
      }>()
    if (!fallbackNegocio.error && fallbackNegocio.data) {
      const categoriaFallback = typeof fallbackNegocio.data.categoria === 'string'
        ? fallbackNegocio.data.categoria
        : null
      negocio = {
        ...fallbackNegocio.data,
        nivel: fallbackNegocio.data.nivel === 'plus' || fallbackNegocio.data.nivel === 'total'
          ? fallbackNegocio.data.nivel
          : 'basico',
        plan_negocio: fallbackNegocio.data.plan_negocio === 'plus' || fallbackNegocio.data.plan_negocio === 'total'
          ? fallbackNegocio.data.plan_negocio
          : 'basico',
        ciudad: typeof fallbackNegocio.data.ciudad === 'string' ? fallbackNegocio.data.ciudad : null,
        zona: typeof fallbackNegocio.data.zona === 'string' ? fallbackNegocio.data.zona : null,
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
  if (negocio.nivel !== 'plus' && negocio.nivel !== 'total') {
    negocio.nivel = 'basico'
  }

  const categoriaNegocio = typeof negocio.categoria === 'string' ? negocio.categoria : null
  const categoriasNegocio = normalizarCategoriasNegocio(negocio.categorias, categoriaNegocio)
  const tieneGymYClases = categoriasNegocio.includes('gimnasio') && categoriasNegocio.includes('clases')
  const zonaNegocio = resolverZonaNegocio({ zona: negocio.zona, ciudad: negocio.ciudad })
  const montoMaximoAutorizadoMxn = categoriaNegocio === 'restaurante'
    ? Math.max(Math.trunc(negocio.monto_maximo_visita ?? 0), 0)
    : null
  const hoy = new Date().toISOString().split('T')[0]
  let tipoServicioDetectado: 'gym' | 'clase' | null = null
  let tipoServicioEfectivo: 'gym' | 'clase' | null = tieneGymYClases
    ? null
    : (categoriasNegocio.includes('gimnasio') ? 'gym' : 'clase')
  let categoriaEfectiva: string | null = categoriaNegocio
  let montoNegocioMxn = tarifaNegocioPorCheckin({
    categoria: categoriaNegocio,
    planNegocio: negocio.plan_negocio,
    zona: negocio.zona,
    ciudad: negocio.ciudad,
  })
  let creditosServicio = 1
  let costoDobleZonaPremium = false
  let permiteVisitaDirecta = categoriaNegocio === 'restaurante' && !negocio.requiere_reserva
  let reservacionACompletarId: string | null = null

  let servicioReservado: { id: string; nombre: string; precio_normal_mxn: number | null; fecha: string } | null = null
  const { data: horariosNegocio, error: horariosError } = await db
    .from('horarios')
    .select('id, tipo_servicio')
    .eq('negocio_id', negocioIdObjetivo)

  if (horariosError) {
    return NextResponse.json({ error: 'No se pudieron validar los horarios del negocio' }, { status: 500 })
  }

  const horarios = Array.isArray(horariosNegocio)
    ? horariosNegocio
    : []
  const horarioIds = horarios
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  const tipoServicioPorHorario = new Map<string, 'gym' | 'clase'>(
    horarios
      .map((horario) => {
        const id = typeof horario.id === 'string' ? horario.id : null
        if (!id) return null
        const tipo = horario.tipo_servicio === 'gym' ? 'gym' : 'clase'
        return [id, tipo] as const
      })
      .filter((entry): entry is readonly [string, 'gym' | 'clase'] => Boolean(entry))
  )

  if (horarioIds.length === 0 && !permiteVisitaDirecta) {
    return NextResponse.json(
      {
        valido: false,
        error: categoriaEfectiva === 'estetica'
          ? 'Este negocio wellness no tiene horarios configurados'
          : 'Este negocio requiere reservación para validar créditos',
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
        .select('id, fecha, created_at, horario_id')
        .eq('user_id', usuarioId)
        .eq('estado', 'confirmada')
        .eq('fecha', hoy)
        .in('horario_id', horarioIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; fecha: string; created_at: string; horario_id: string | null }>()

      if (reservacionConfirmadaError) {
        return NextResponse.json({ error: 'No se pudo validar la reservación del usuario' }, { status: 500 })
      }

      if (reservacionConfirmada) {
        reservacionACompletarId = reservacionConfirmada.id
        if (typeof reservacionConfirmada.horario_id === 'string') {
          tipoServicioDetectado = tipoServicioPorHorario.get(reservacionConfirmada.horario_id) ?? null
        }
      }
    }
  }
  tipoServicioEfectivo = tipoServicioDetectado ?? tipoServicioBody ?? tipoServicioEfectivo
  if (tieneGymYClases && !tipoServicioEfectivo) {
    return NextResponse.json({ valido: false, error: 'Selecciona el servicio usado: Gym o Clase.' }, { status: 400 })
  }
  categoriaEfectiva = tipoServicioEfectivo === 'gym'
    ? 'gimnasio'
    : (tipoServicioEfectivo === 'clase' ? 'clases' : categoriaNegocio)
  permiteVisitaDirecta = (
    (categoriaEfectiva === 'restaurante' && !negocio.requiere_reserva)
    || categoriaEfectiva === 'gimnasio'
  )

  if (!reservacionACompletarId && categoriaEfectiva === 'clases' && tieneGymYClases) {
    return NextResponse.json({ valido: false, error: 'Para validar Clase necesitas una reservación confirmada para hoy.' }, { status: 400 })
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
  creditosServicio = categoriaEfectiva === 'gimnasio' ? 0.5 : 1
  costoDobleZonaPremium = categoriaEfectiva !== 'gimnasio' && zonaUsuario === 'zona1' && zonaNegocio === 'zona2'
  if (costoDobleZonaPremium) {
    creditosServicio = creditosServicio * 2
  }
  if (((visitasCiclo ?? 0) + creditosServicio) > visitasDisponibles) {
    return NextResponse.json({ valido: false, error: 'Usuario agotó sus créditos del ciclo actual' })
  }
  if (((visitasLugarCiclo ?? 0) + creditosServicio) > limitePorLugar) {
    return NextResponse.json({
      valido: false,
      error: 'Límite de créditos en este lugar alcanzado',
    })
  }
  montoNegocioMxn = categoriaEfectiva === 'clases' && tieneGymYClases
    ? calcularMontoNegocioPorVisita({
      categoria: 'clases',
      planUsuario,
      zona: negocio.zona,
      ciudad: negocio.ciudad,
    })
    : tarifaNegocioPorCheckin({
      categoria: categoriaEfectiva,
      planNegocio: negocio.plan_negocio,
      zona: negocio.zona,
      ciudad: negocio.ciudad,
    })

  if (soloCotizar) {
    return NextResponse.json({
      valido: true,
      requiere_confirmacion: true,
      usuario: usuario.nombre,
      negocio: negocio.nombre,
      categoria_negocio: categoriaEfectiva,
      tipo_servicio: tipoServicioEfectivo,
      servicio_reservado: servicioReservado,
      monto_negocio_mxn: montoNegocioMxn,
      monto_maximo_autorizado_mxn: montoMaximoAutorizadoMxn,
      creditos_servicio: creditosServicio,
      costo_doble_aplicado: costoDobleZonaPremium,
      mensaje_costo: costoDobleZonaPremium
        ? `Este servicio cuesta ${creditosServicio} créditos (zona premium, costo doble)`
        : `Este servicio cuesta ${creditosServicio} crédito${creditosServicio === 1 ? '' : 's'}`,
      creditos_restantes_ciclo: Math.max(visitasDisponibles - ((visitasCiclo ?? 0) + creditosServicio), 0),
      creditos_usados_ciclo: (visitasCiclo ?? 0),
      limite_creditos_ciclo: limiteMensual,
      creditos_disponibles: visitasDisponibles,
      visitas_restantes_mes: Math.max(visitasDisponibles - ((visitasCiclo ?? 0) + creditosServicio), 0),
      visitas_usadas_mes: (visitasCiclo ?? 0),
      limite_visitas_mensuales: limiteMensual,
      visitas_disponibles: visitasDisponibles,
      visitas_restantes_ciclo: Math.max(visitasDisponibles - ((visitasCiclo ?? 0) + creditosServicio), 0),
      visitas_usadas_ciclo: (visitasCiclo ?? 0),
      ciclo_inicio: ciclo.inicio.toISOString(),
      ciclo_fin: ciclo.fin.toISOString(),
    })
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
    return NextResponse.json({ error: 'Error al registrar crédito' }, { status: 500 })
  }

  if (reservacionACompletarId) {
    const updateConNegocio = await db
      .from('reservaciones')
      .update({ estado: 'completada' })
      .eq('id', reservacionACompletarId)
      .eq('user_id', usuarioId)
      .eq('negocio_id', negocioIdObjetivo)
      .eq('fecha', hoy)
      .eq('estado', 'confirmada')
    if (updateConNegocio.error && faltaColumna(updateConNegocio.error, 'negocio_id')) {
      const updateConHorarios = await db
        .from('reservaciones')
        .update({ estado: 'completada' })
        .eq('id', reservacionACompletarId)
        .eq('user_id', usuarioId)
        .eq('fecha', hoy)
        .eq('estado', 'confirmada')
        .in('horario_id', horarioIds)
      if (updateConHorarios.error) {
        console.warn('[POST /api/validar] No se pudo completar la reservación', updateConHorarios.error)
      }
    } else if (updateConNegocio.error) {
      console.warn('[POST /api/validar] No se pudo completar la reservación', updateConNegocio.error)
    }
  }

  const { error: ultimoCheckinError } = await db
    .from('users')
    .update({ ultimo_checkin: new Date().toISOString() })
    .eq('id', usuarioId)
  if (ultimoCheckinError && !faltaColumna(ultimoCheckinError, 'ultimo_checkin')) {
    console.warn('[POST /api/validar] No se pudo actualizar ultimo_checkin', ultimoCheckinError)
  }
  if (perfil.rol === 'validador' && validadorId) {
    await db
      .from('validadores')
      .update({ ultima_actividad: new Date().toISOString() })
      .eq('id', validadorId)
  }

  void notificarActualizacionWallet(usuarioId).catch((err) => {
    console.warn('[POST /api/validar] wallet update failed:', err)
  })

  const visitasUsadasCiclo = (visitasCiclo ?? 0) + creditosServicio
  const visitasRestantesCiclo = Math.max(visitasDisponibles - visitasUsadasCiclo, 0)

  return NextResponse.json({
    valido: true,
    usuario: usuario.nombre,
    negocio: negocio.nombre,
    categoria_negocio: categoriaEfectiva,
    tipo_servicio: tipoServicioEfectivo,
    servicio_reservado: servicioReservado,
    monto_negocio_mxn: montoNegocioMxn,
    monto_maximo_autorizado_mxn: montoMaximoAutorizadoMxn,
    creditos_servicio: creditosServicio,
    costo_doble_aplicado: costoDobleZonaPremium,
    mensaje_costo: costoDobleZonaPremium
      ? `Este servicio cuesta ${creditosServicio} créditos (zona premium, costo doble)`
      : `Este servicio cuesta ${creditosServicio} crédito${creditosServicio === 1 ? '' : 's'}`,
    creditos_restantes_ciclo: visitasRestantesCiclo,
    creditos_usados_ciclo: visitasUsadasCiclo,
    limite_creditos_ciclo: limiteMensual,
    creditos_disponibles: visitasDisponibles,
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
