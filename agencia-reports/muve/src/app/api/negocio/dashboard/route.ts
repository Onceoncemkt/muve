import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import {
  normalizarCategoriaNegocio,
  normalizarPlan,
  obtenerTarifasNegocioPorPlan,
} from '@/lib/planes'
import type { PlanMembresia, Rol } from '@/types'

type Perfil = {
  rol: Rol
  negocio_id: string | null
}

function planTarifaParaVisita({
  categoria,
  planUsuario,
}: {
  categoria: string | null | undefined
  planUsuario: string | null | undefined
}) {

  const categoriaNormalizada = normalizarCategoriaNegocio(categoria)
  if (categoriaNormalizada && categoriaNormalizada !== 'clases') {
    return 'basico'
  }
  const planNormalizado = normalizarPlan(planUsuario)
  if (planNormalizado) return planNormalizado

  return null
}

type NegocioDashboard = {
  id: string
  nombre: string
  ciudad: string
  categoria: string
  imagen_url?: string | null
  instagram_handle?: string | null
  tiktok_handle?: string | null
  stripe_account_id?: string | null
}

type GananciasSemana = {
  visitas_por_plan: Record<PlanMembresia, number>
  total_por_plan: Record<PlanMembresia, number>
  total_a_cobrar: number
}

type GananciasHistoricoMes = {
  mes: string
  visitas: number
  total_ganado: number
}

type GananciasDashboard = {
  tarifas_por_plan: Record<PlanMembresia, number>
  semana: GananciasSemana
  historico_mensual: GananciasHistoricoMes[]
  nota: string
}

type VisitaGanancias = {
  fecha: string
  plan_usuario: string | null
}

type UsuarioCheckin = {
  id: string
  nombre: string
  email: string | null
}

type CheckinHoyDB = {
  id: string
  fecha: string
  user_id: string
  users: UsuarioCheckin | UsuarioCheckin[] | null
}

type CheckinHoyDashboard = {
  id: string
  fecha: string
  user_id: string
  usuario_nombre: string
  usuario_email: string | null
}

type ServicioNegocioDashboard = {
  id: string
  nombre: string
  precio_normal_mxn: number | null
}

type EstadoPagoDashboard = 'pagado' | 'pendiente'

type PagoSemanalDashboard = {
  periodo_inicio: string
  periodo_fin: string
  visitas_basico: number
  visitas_plus: number
  visitas_total: number
  total_mxn: number
  estado: EstadoPagoDashboard
  stripe_transfer_id: string | null
  created_at: string | null
}

type PagoNegocioDB = {
  periodo_inicio: string
  periodo_fin: string
  visitas_basico: number | null
  visitas_plus: number | null
  visitas_total: number | null
  total_mxn: number | null
  estado: string | null
  stripe_transfer_id: string | null
  created_at: string | null
}

type PagosDashboard = {
  historial_semanal: PagoSemanalDashboard[]
  proximo_pago_estimado: PagoSemanalDashboard
}

const PLANES_MEMBRESIA: PlanMembresia[] = ['basico', 'plus', 'total']
const NOTA_GANANCIAS = 'MUVET hace corte, y te paga el total acumulado cada semana'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

function validarFecha(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const parsed = new Date(`${fecha}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function faltaRelacion(error: { message?: string } | null | undefined, relacion: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relacion.toLowerCase()) && message.includes('does not exist')
}

function normalizarHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim().replace(/^@+/, '')
  return limpio.length > 0 ? limpio : null
}

function obtenerRelacion<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function inicioSemanaLocal(fecha: Date) {
  const inicio = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)
  const diaSemana = inicio.getDay()
  const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana
  inicio.setDate(inicio.getDate() + diferencia)
  return inicio
}

function finSemanaLocal(inicioSemana: Date) {
  const fin = new Date(inicioSemana)
  fin.setDate(fin.getDate() + 6)
  return fin
}

function formatoFechaISO(fecha: Date) {
  return fecha.toISOString().split('T')[0]
}

function recordPlanInicial() {
  return {
    basico: 0,
    plus: 0,
    total: 0,
  } satisfies Record<PlanMembresia, number>
}

function etiquetaMes(clave: string) {
  const [anio, mes] = clave.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, 1))
  const texto = fecha.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function gananciasVacias(): GananciasDashboard {
  const tarifasPorPlan = obtenerTarifasNegocioPorPlan('clases')
  return {
    tarifas_por_plan: tarifasPorPlan,
    semana: {
      visitas_por_plan: recordPlanInicial(),
      total_por_plan: recordPlanInicial(),
      total_a_cobrar: 0,
    },
    historico_mensual: [],
    nota: NOTA_GANANCIAS,
  }
}

function estadoPagoDashboard(estado: string | null | undefined): EstadoPagoDashboard {
  return estado === 'completado' || estado === 'pagado'
    ? 'pagado'
    : 'pendiente'
}

function pagoSemanalVacio(periodoInicio: string, periodoFin: string): PagoSemanalDashboard {
  return {
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    visitas_basico: 0,
    visitas_plus: 0,
    visitas_total: 0,
    total_mxn: 0,
    estado: 'pendiente',
    stripe_transfer_id: null,
    created_at: null,
  }
}

function pagosVacios(): PagosDashboard {
  const inicioSemana = inicioSemanaLocal(new Date())
  const finSemana = finSemanaLocal(inicioSemana)
  return {
    historial_semanal: [],
    proximo_pago_estimado: pagoSemanalVacio(
      formatoFechaISO(inicioSemana),
      formatoFechaISO(finSemana)
    ),
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<Perfil>()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdSolicitado = searchParams.get('negocio_id')
  const fecha = searchParams.get('fecha') ?? hoyISO()

  if (!validarFecha(fecha)) {
    return NextResponse.json({ error: 'fecha inválida' }, { status: 400 })
  }

  if (perfil.rol === 'staff' && !perfil.negocio_id) {
    return NextResponse.json({
      sin_negocio: true,
      fecha,
      checkins_hoy: [],
      servicios_disponibles: [],
      reservaciones: [],
      resumen: {
        reservaciones_hoy: 0,
        checkins_hoy: 0,
        horarios_activos: 0,
      },
      ganancias: gananciasVacias(),
      pagos: pagosVacios(),
    })
  }

  if (perfil.rol === 'staff' && negocioIdSolicitado && negocioIdSolicitado !== perfil.negocio_id) {
    return NextResponse.json(
      { error: 'No puedes consultar datos de otro negocio' },
      { status: 403 }
    )
  }

  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdSolicitado ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json(
      { error: 'negocio_id requerido para admin' },
      { status: 400 }
    )
  }

  const consultasNegocio = [
    { select: 'id, nombre, ciudad, categoria, imagen_url, instagram_handle, tiktok_handle, stripe_account_id', incluyeImagen: true, incluyeInstagram: true, incluyeTiktok: true, incluyeStripeAccountId: true },
    { select: 'id, nombre, ciudad, categoria, imagen_url, instagram_handle, stripe_account_id', incluyeImagen: true, incluyeInstagram: true, incluyeTiktok: false, incluyeStripeAccountId: true },
    { select: 'id, nombre, ciudad, categoria, imagen_url, instagram_handle', incluyeImagen: true, incluyeInstagram: true, incluyeTiktok: false, incluyeStripeAccountId: false },
    { select: 'id, nombre, ciudad, categoria, imagen_url', incluyeImagen: true, incluyeInstagram: false, incluyeTiktok: false, incluyeStripeAccountId: false },
    { select: 'id, nombre, ciudad, categoria', incluyeImagen: false, incluyeInstagram: false, incluyeTiktok: false, incluyeStripeAccountId: false },
  ] as const

  let negocio: NegocioDashboard | null = null
  let negocioError: { message?: string } | null = null

  for (const consulta of consultasNegocio) {
    const resultado = await db
      .from('negocios')
      .select(consulta.select)
      .eq('id', negocioIdObjetivo)
      .maybeSingle<NegocioDashboard>()

    if (!resultado.error && resultado.data) {
      negocio = {
        id: resultado.data.id,
        nombre: resultado.data.nombre,
        ciudad: resultado.data.ciudad,
        categoria: resultado.data.categoria,
        imagen_url: consulta.incluyeImagen ? (resultado.data.imagen_url ?? null) : null,
        instagram_handle: consulta.incluyeInstagram ? (resultado.data.instagram_handle ?? null) : null,
        tiktok_handle: consulta.incluyeTiktok ? (resultado.data.tiktok_handle ?? null) : null,
        stripe_account_id: consulta.incluyeStripeAccountId ? (resultado.data.stripe_account_id ?? null) : null,
      }
      negocioError = null
      break
    }

    negocioError = resultado.error
    const errorPorColumnaOpcional = (
      (consulta.incluyeImagen && faltaColumna(resultado.error, 'imagen_url'))
      || (consulta.incluyeInstagram && faltaColumna(resultado.error, 'instagram_handle'))
      || (consulta.incluyeTiktok && faltaColumna(resultado.error, 'tiktok_handle'))
      || (consulta.incluyeStripeAccountId && faltaColumna(resultado.error, 'stripe_account_id'))
    )
    if (!errorPorColumnaOpcional) break
  }

  if (negocioError || !negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const categoriaNegocioNormalizada = normalizarCategoriaNegocio(negocio.categoria)
  let serviciosDisponibles: Array<{ id: string; nombre: string; precio_normal_mxn: number }> = []
  const serviciosResult = await db
    .from('negocio_servicios')
    .select('id, nombre, precio_normal_mxn')
    .eq('negocio_id', negocioIdObjetivo)
    .eq('activo', true)
    .order('created_at', { ascending: true })
    .returns<ServicioNegocioDashboard[]>()

  if (!serviciosResult.error) {
    serviciosDisponibles = (serviciosResult.data ?? []).map((servicio) => ({
      id: servicio.id,
      nombre: servicio.nombre,
      precio_normal_mxn: typeof servicio.precio_normal_mxn === 'number'
        ? Math.max(Math.trunc(servicio.precio_normal_mxn), 0)
        : 0,
    }))
  } else if (!faltaRelacion(serviciosResult.error, 'negocio_servicios')) {
    return NextResponse.json(
      { error: serviciosResult.error.message ?? 'Error al cargar servicios disponibles' },
      { status: 500 }
    )
  }
  const categoriaParaDashboard = (
    categoriaNegocioNormalizada === 'estetica'
    || serviciosDisponibles.length > 0
  )
    ? 'estetica'
    : negocio.categoria
  if (categoriaParaDashboard === 'estetica' && negocio.categoria !== 'estetica') {
    negocio = {
      ...negocio,
      categoria: 'estetica',
    }
  }

  const inicioDiaCheckins = `${fecha}T00:00:00`
  const fechaSiguiente = new Date(`${fecha}T00:00:00`)
  fechaSiguiente.setDate(fechaSiguiente.getDate() + 1)
  const finDiaCheckins = `${formatoFechaISO(fechaSiguiente)}T00:00:00`

  const [
    { data: reservaciones, error: reservacionesError },
    { count: horariosActivos, error: horariosError },
    { data: checkinsHoyRaw, error: checkinsError },
  ] = await Promise.all([
    db
      .from('reservaciones')
      .select(`
        id, fecha, estado, created_at, servicio_id, servicio_nombre,
        users ( id, nombre, email ),
        horarios!inner ( id, dia_semana, hora_inicio, hora_fin, nombre_coach, tipo_clase, negocio_id )
      `)
      .eq('horarios.negocio_id', negocioIdObjetivo)
      .eq('fecha', fecha)
      .order('horarios(hora_inicio)', { ascending: true }),
    db
      .from('horarios')
      .select('id', { count: 'exact', head: true })
      .eq('negocio_id', negocioIdObjetivo)
      .eq('activo', true),
    db
      .from('visitas')
      .select(`
        id, fecha, user_id,
        users ( id, nombre, email )
      `)
      .eq('negocio_id', negocioIdObjetivo)
      .gte('fecha', inicioDiaCheckins)
      .lt('fecha', finDiaCheckins)
      .order('fecha', { ascending: false }),
  ])

  if (reservacionesError || horariosError || checkinsError) {
    return NextResponse.json(
      { error: reservacionesError?.message ?? horariosError?.message ?? checkinsError?.message ?? 'Error al cargar dashboard' },
      { status: 500 }
    )
  }

  const checkinsHoy = ((checkinsHoyRaw ?? []) as CheckinHoyDB[]).map((checkin) => {
    const usuario = obtenerRelacion(checkin.users)
    return {
      id: checkin.id,
      fecha: checkin.fecha,
      user_id: checkin.user_id,
      usuario_nombre: usuario?.nombre ?? 'Usuario',
      usuario_email: usuario?.email ?? null,
    } satisfies CheckinHoyDashboard
  })

  let visitasGanancias: VisitaGanancias[] = []
  const visitasConPlan = await db
    .from('visitas')
    .select('fecha, plan_usuario')
    .eq('negocio_id', negocioIdObjetivo)
    .returns<VisitaGanancias[]>()

  if (!visitasConPlan.error) {
    visitasGanancias = visitasConPlan.data ?? []
  } else if (faltaColumna(visitasConPlan.error, 'plan_usuario')) {
    const visitasFallback = await db
      .from('visitas')
      .select('fecha')
      .eq('negocio_id', negocioIdObjetivo)
      .returns<Array<{ fecha: string }>>()

    if (visitasFallback.error) {
      return NextResponse.json(
        { error: visitasFallback.error.message ?? 'Error al cargar ganancias' },
        { status: 500 }
      )
    }

    visitasGanancias = (visitasFallback.data ?? []).map((visita) => ({
      fecha: visita.fecha,
      plan_usuario: null,
    }))
  } else {
    return NextResponse.json(
      { error: visitasConPlan.error.message ?? 'Error al cargar ganancias' },
      { status: 500 }
    )
  }

  const inicioSemana = inicioSemanaLocal(new Date())
  const finSemana = new Date(inicioSemana)
  finSemana.setDate(finSemana.getDate() + 7)
  const tarifasPorPlan = obtenerTarifasNegocioPorPlan(categoriaParaDashboard)

  const visitasSemana = recordPlanInicial()
  const totalSemanaPorPlan = recordPlanInicial()
  const historicoPorMes = new Map<string, { visitas: number; total_ganado: number }>()

  for (const visita of visitasGanancias) {
    const fechaVisita = new Date(visita.fecha)
    if (Number.isNaN(fechaVisita.getTime())) continue
    const planTarifa = planTarifaParaVisita({
      categoria: categoriaParaDashboard,
      planUsuario: visita.plan_usuario,
    })
    const tarifa = planTarifa ? tarifasPorPlan[planTarifa] : 0

    if (planTarifa && fechaVisita >= inicioSemana && fechaVisita < finSemana) {
      visitasSemana[planTarifa] += 1
      totalSemanaPorPlan[planTarifa] += tarifa
    }

    const claveMes = `${fechaVisita.getUTCFullYear()}-${String(fechaVisita.getUTCMonth() + 1).padStart(2, '0')}`
    const acumuladoMes = historicoPorMes.get(claveMes) ?? { visitas: 0, total_ganado: 0 }
    acumuladoMes.visitas += 1
    acumuladoMes.total_ganado += tarifa
    historicoPorMes.set(claveMes, acumuladoMes)
  }

  const historicoMensual = Array.from(historicoPorMes.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([claveMes, valores]) => ({
      mes: etiquetaMes(claveMes),
      visitas: valores.visitas,
      total_ganado: valores.total_ganado,
    }))

  const totalSemana = PLANES_MEMBRESIA.reduce((suma, plan) => suma + totalSemanaPorPlan[plan], 0)

  let pagosHistorico: PagoSemanalDashboard[] = []
  const pagosResult = await db
    .from('pagos_negocios')
    .select('periodo_inicio, periodo_fin, visitas_basico, visitas_plus, visitas_total, total_mxn, estado, stripe_transfer_id, created_at')
    .eq('negocio_id', negocioIdObjetivo)
    .order('periodo_fin', { ascending: false })
    .limit(20)
    .returns<PagoNegocioDB[]>()

  if (!pagosResult.error) {
    pagosHistorico = (pagosResult.data ?? []).map((pago) => ({
      periodo_inicio: pago.periodo_inicio,
      periodo_fin: pago.periodo_fin,
      visitas_basico: pago.visitas_basico ?? 0,
      visitas_plus: pago.visitas_plus ?? 0,
      visitas_total: pago.visitas_total ?? 0,
      total_mxn: pago.total_mxn ?? 0,
      estado: estadoPagoDashboard(pago.estado),
      stripe_transfer_id: pago.stripe_transfer_id ?? null,
      created_at: pago.created_at ?? null,
    }))
  } else if (!faltaRelacion(pagosResult.error, 'pagos_negocios')) {
    return NextResponse.json(
      { error: pagosResult.error.message ?? 'Error al cargar historial de pagos' },
      { status: 500 }
    )
  }

  const inicioSemanaActual = formatoFechaISO(inicioSemana)
  const finSemanaActual = formatoFechaISO(finSemanaLocal(inicioSemana))
  const proximoPagoEstimado: PagoSemanalDashboard = {
    periodo_inicio: inicioSemanaActual,
    periodo_fin: finSemanaActual,
    visitas_basico: visitasSemana.basico,
    visitas_plus: visitasSemana.plus,
    visitas_total: visitasSemana.total,
    total_mxn: totalSemana,
    estado: 'pendiente',
    stripe_transfer_id: null,
    created_at: null,
  }

  const pagoSemanaActual = pagosHistorico.find(
    pago => pago.periodo_inicio === inicioSemanaActual && pago.periodo_fin === finSemanaActual
  )

  return NextResponse.json({
    sin_negocio: false,
    fecha,
    negocio,
    checkins_hoy: checkinsHoy,
    servicios_disponibles: serviciosDisponibles,
    resumen: {
      reservaciones_hoy: (reservaciones ?? []).length,
      checkins_hoy: checkinsHoy.length,
      horarios_activos: horariosActivos ?? 0,
    },
    ganancias: {
      tarifas_por_plan: tarifasPorPlan,
      semana: {
        visitas_por_plan: visitasSemana,
        total_por_plan: totalSemanaPorPlan,
        total_a_cobrar: totalSemana,
      },
      historico_mensual: historicoMensual,
      nota: NOTA_GANANCIAS,
    },
    pagos: {
      historial_semanal: pagosHistorico,
      proximo_pago_estimado: pagoSemanaActual ?? proximoPagoEstimado,
    },
    reservaciones: reservaciones ?? [],
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<Perfil>()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as {
    instagram_handle?: unknown
    tiktok_handle?: unknown
    negocio_id?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : null
  const negocioIdQuery = searchParams.get('negocio_id')
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdBody ?? negocioIdQuery ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json({ error: 'negocio_id requerido' }, { status: 400 })
  }

  const instagramHandle = normalizarHandle(body.instagram_handle)
  const tiktokHandle = normalizarHandle(body.tiktok_handle)

  const payload: Record<string, string | null> = {
    instagram_handle: instagramHandle,
    tiktok_handle: tiktokHandle,
  }

  let error: { message?: string } | null = null

  for (let intento = 0; intento < 3; intento += 1) {
    const resultado = await db
      .from('negocios')
      .update(payload)
      .eq('id', negocioIdObjetivo)

    if (!resultado.error) {
      error = null
      break
    }

    error = resultado.error
    if (faltaColumna(resultado.error, 'tiktok_handle') && 'tiktok_handle' in payload) {
      delete payload.tiktok_handle
      continue
    }
    if (faltaColumna(resultado.error, 'instagram_handle') && 'instagram_handle' in payload) {
      delete payload.instagram_handle
      continue
    }
    break
  }

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'No se pudo actualizar el perfil del negocio' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    negocio: {
      id: negocioIdObjetivo,
      instagram_handle: 'instagram_handle' in payload ? instagramHandle : null,
      tiktok_handle: 'tiktok_handle' in payload ? tiktokHandle : null,
    },
  })
}
