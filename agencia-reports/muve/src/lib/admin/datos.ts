import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { CIUDADES_OPERATIVAS, ZONA_NEGOCIO_LABELS } from '@/types'
import { tarifaNegocioPorCheckin } from '@/lib/planes'
import type { Ciudad, Categoria, NivelNegocio, Rol, ZonaNegocio } from '@/types'
import { obtenerRolServidor } from '@/lib/auth/server-role'
import { obtenerStripeStatus, type StripeConnectStatus } from '@/lib/stripe-connect'

// ───────────────────────── Tipos ─────────────────────────

export type UsuarioAdmin = {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  rol: Rol
  edad: number | null
  plan_activo: boolean
  creditos_extra: number | null
  negocio_id: string | null
  fecha_registro: string
}

export type NegocioAdmin = {
  id: string
  nombre: string
  ciudad: Ciudad
  zona?: ZonaNegocio | null
  nivel?: NivelNegocio
  plan_negocio?: NivelNegocio | null
  categoria: Categoria
  categorias?: Categoria[] | null
  direccion: string
  descripcion: string | null
  imagen_url: string | null
  logo_url: string | null
  mostrar_en_landing: boolean
  instagram_handle: string | null
  requiere_reserva: boolean
  capacidad_default: number | null
  stripe_account_id: string | null
  activo: boolean
}

export type CreditoOtorgadoRow = {
  id: string
  user_id: string
  cantidad: number
  motivo: string
  created_at: string
  otorgado_por: string | null
  users: { nombre: string; email: string } | null
}

export type VisitaFinanzasRow = {
  id: string
  negocio_id: string
  fecha: string
  monto_negocio?: number | null
  estado?: string | null
}

export type PagoNegocioFinanzasRow = {
  id: string
  negocio_id: string
  periodo_inicio: string
  periodo_fin: string
  total_mxn: number | null
  estado: string | null
  created_at?: string | null
}

// ───────────────────────── Constantes ─────────────────────────

export const CIUDADES: Ciudad[] = CIUDADES_OPERATIVAS
export const CATEGORIAS: Categoria[] = ['gimnasio', 'clases', 'estetica', 'restaurante', 'clinica']
export const CATEGORIA_FORM_LABELS: Record<Categoria, string> = {
  gimnasio: 'GYM',
  clases: 'CLASES',
  estetica: 'ESTÉTICAS Y SPA',
  restaurante: 'RESTAURANTE',
  clinica: 'CLÍNICA',
}
export const ZONAS: ZonaNegocio[] = ['zona1', 'zona1_5', 'zona2']
export const NIVELES: NivelNegocio[] = ['basico', 'plus', 'total']
export const ZONA_LABELS: Record<ZonaNegocio, string> = ZONA_NEGOCIO_LABELS
export const NIVEL_LABELS: Record<NivelNegocio, string> = {
  basico: 'Básico',
  plus: 'Plus',
  total: 'Total',
}
export const CATEGORIA_TARIFA_LABELS: Record<Categoria, string> = {
  gimnasio: 'Gym',
  clases: 'Clases',
  estetica: 'Wellness',
  restaurante: 'Restaurante',
  clinica: 'Clínica',
}

// ───────────────────────── Cliente y gating ─────────────────────────

export function adminDb(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Verifica que el visitante es admin (o que está habilitado el preview local).
 * Redirige a /login o /dashboard si no cumple. Devuelve si el preview está activo.
 */
export async function requireAdmin(): Promise<{ adminPreviewEnabled: boolean }> {
  const adminPreviewEnabled = process.env.NODE_ENV === 'development' && process.env.PREVIEW_ADMIN === 'true'
  if (adminPreviewEnabled) return { adminPreviewEnabled }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const rol = await obtenerRolServidor(user)
  if (rol !== 'admin') redirect('/dashboard')
  return { adminPreviewEnabled }
}

// ───────────────────────── Helpers de columnas ausentes ─────────────────────────

export function faltaColumnaRequiereReserva(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column')
    && (
      message.includes('requiere_reserva')
      || message.includes('capacidad_default')
      || message.includes('instagram_handle')
      || message.includes('imagen_url')
      || message.includes('logo_url')
      || message.includes('mostrar_en_landing')
      || message.includes('stripe_account_id')
      || message.includes('zona')
      || message.includes('nivel')
      || message.includes('plan_negocio')
    )
}

export function faltaColumnaEdad(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('edad')
}

export function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('negocio_id')
}

export function faltaColumnaExacta(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

// ───────────────────────── Normalizadores / formato ─────────────────────────

export function normalizarEdad(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export function calcularEdadDesdeFecha(fecha: unknown): number | null {
  if (typeof fecha !== 'string' || !fecha.trim()) return null
  const nacimiento = new Date(fecha)
  if (Number.isNaN(nacimiento.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad -= 1
  }
  return edad > 0 ? edad : null
}

export function formatearMonto(valor: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function aNumero(valor: unknown) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string') {
    const parsed = Number(valor)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function aFechaIsoDia(fecha: Date) {
  return fecha.toISOString().slice(0, 10)
}

export function inicioSemanaCalendario(fecha: Date) {
  const base = new Date(fecha)
  base.setHours(0, 0, 0, 0)
  const offsetLunes = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - offsetLunes)
  return base
}

export function inicioMesCalendario(fecha: Date) {
  const base = new Date(fecha)
  base.setHours(0, 0, 0, 0)
  base.setDate(1)
  return base
}

export function esFechaISOValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

export function pagoLiquidado(estado: string | null | undefined) {
  const valor = (estado ?? '').toLowerCase()
  return valor === 'pagado' || valor === 'completado' || valor === 'paid' || valor === 'succeeded'
}

export function fechaPagoISO(pago: PagoNegocioFinanzasRow) {
  if (typeof pago.created_at === 'string' && pago.created_at.trim()) {
    return pago.created_at.slice(0, 10)
  }
  if (typeof pago.periodo_fin === 'string' && pago.periodo_fin.trim()) {
    return pago.periodo_fin.slice(0, 10)
  }
  return ''
}

export function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return '—'
  const parsed = new Date(fecha)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' })
}

// ───────────────────────── Loaders ─────────────────────────

/** Usuarios + enriquecimiento de edad desde auth metadata. */
export async function cargarUsuarios(db: SupabaseClient): Promise<{
  usuarios: UsuarioAdmin[]
  usuariosConNegocioIdDisponible: boolean
}> {
  const consultasUsuarios = [
    { select: 'id, nombre, email, ciudad, rol, edad, plan_activo, creditos_extra, negocio_id, fecha_registro', incluyeNegocioId: true },
    { select: 'id, nombre, email, ciudad, rol, plan_activo, creditos_extra, negocio_id, fecha_registro', incluyeNegocioId: true },
    { select: 'id, nombre, email, ciudad, rol, edad, plan_activo, creditos_extra, fecha_registro', incluyeNegocioId: false },
    { select: 'id, nombre, email, ciudad, rol, plan_activo, creditos_extra, fecha_registro', incluyeNegocioId: false },
  ] as const

  type UsuarioFlexible = Omit<UsuarioAdmin, 'edad' | 'negocio_id'> & {
    edad?: unknown
    creditos_extra?: unknown
    negocio_id?: unknown
  }

  let usuarios: UsuarioAdmin[] = []
  let usuariosConNegocioIdDisponible = true

  for (const consulta of consultasUsuarios) {
    const resultado = await db
      .from('users')
      .select(consulta.select)
      .order('fecha_registro', { ascending: false })

    if (!resultado.error) {
      usuariosConNegocioIdDisponible = consulta.incluyeNegocioId
      usuarios = ((resultado.data ?? []) as unknown as UsuarioFlexible[]).map(usuario => ({
        ...usuario,
        edad: normalizarEdad(usuario.edad),
        creditos_extra: typeof usuario.creditos_extra === 'number'
          ? Math.max(Math.trunc(usuario.creditos_extra), 0)
          : 0,
        negocio_id: typeof usuario.negocio_id === 'string' ? usuario.negocio_id : null,
      }))
      break
    }

    const errorPorColumnaOpcional = faltaColumnaEdad(resultado.error) || faltaColumnaNegocioId(resultado.error)
    if (!errorPorColumnaOpcional) break
  }

  // Enriquecer edad desde auth metadata cuando la columna está ausente o vacía.
  const authUsers = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const edadPorUsuario = new Map<string, number>()
  for (const authUser of authUsers.data?.users ?? []) {
    const metadata = authUser.user_metadata as Record<string, unknown> | undefined
    const edadMetadata = normalizarEdad(metadata?.edad)
      ?? normalizarEdad(metadata?.age)
      ?? calcularEdadDesdeFecha(metadata?.fecha_nacimiento)
      ?? calcularEdadDesdeFecha(metadata?.birthdate)
    if (edadMetadata) edadPorUsuario.set(authUser.id, edadMetadata)
  }

  const usuariosEnriquecidos = usuarios.map(usuario => ({
    ...usuario,
    edad: usuario.edad ?? edadPorUsuario.get(usuario.id) ?? null,
  }))

  return { usuarios: usuariosEnriquecidos, usuariosConNegocioIdDisponible }
}

/** Negocios afiliados con todos los fallbacks de esquema. */
export async function cargarNegocios(db: SupabaseClient): Promise<NegocioAdmin[]> {
  let negociosAfiliados: NegocioAdmin[] = []
  let consultaNegociosError: { message?: string } | null = null

  const consultaConPlan = await db
    .from('negocios')
    .select('id, nombre, categoria, categorias, ciudad, zona, plan_negocio, activo, stripe_account_id, direccion, imagen_url, instagram_handle, descripcion, logo_url, mostrar_en_landing, requiere_reserva, capacidad_default, nivel')
    .order('nombre')

  if (!consultaConPlan.error) {
    negociosAfiliados = (consultaConPlan.data ?? []) as NegocioAdmin[]
  } else {
    consultaNegociosError = consultaConPlan.error
    if (faltaColumnaRequiereReserva(consultaConPlan.error)) {
      const consultaSinPlan = await db
        .from('negocios')
        .select('id, nombre, ciudad, zona, nivel, categoria, categorias, direccion, descripcion, imagen_url, logo_url, mostrar_en_landing, instagram_handle, requiere_reserva, capacidad_default, stripe_account_id, activo')
        .order('ciudad')
        .order('nombre')

      if (!consultaSinPlan.error) {
        negociosAfiliados = ((consultaSinPlan.data ?? []) as Omit<NegocioAdmin, 'plan_negocio'>[]).map(negocio => ({
          ...negocio,
          plan_negocio: 'basico',
        }))
        consultaNegociosError = null
      } else {
        consultaNegociosError = consultaSinPlan.error
      }
    }
  }

  if (consultaNegociosError && faltaColumnaRequiereReserva(consultaNegociosError)) {
    type NegocioAdminLegacy = Omit<NegocioAdmin, 'zona' | 'nivel' | 'plan_negocio' | 'imagen_url' | 'logo_url' | 'mostrar_en_landing' | 'instagram_handle' | 'requiere_reserva' | 'capacidad_default' | 'stripe_account_id'>
    const fallback = await db
      .from('negocios')
      .select('id, nombre, ciudad, categoria, direccion, descripcion, activo')
      .order('ciudad')
      .order('nombre')

    if (!fallback.error) {
      negociosAfiliados = ((fallback.data ?? []) as NegocioAdminLegacy[]).map(negocio => ({
        ...negocio,
        zona: 'zona1',
        nivel: 'basico',
        plan_negocio: 'basico',
        imagen_url: null,
        logo_url: null,
        mostrar_en_landing: false,
        instagram_handle: null,
        requiere_reserva: true,
        capacidad_default: 10,
        stripe_account_id: null,
      }))
    }
  }

  return negociosAfiliados
}

/** Relaciones usuarios↔negocios (mapas y opciones para selects de staff). */
export function derivarRelaciones(usuarios: UsuarioAdmin[], negocios: NegocioAdmin[]) {
  const negociosPorId = new Map(negocios.map(negocio => [negocio.id, negocio]))
  const negociosOpciones = negocios.map(negocio => ({
    id: negocio.id,
    nombre: negocio.nombre,
    activo: negocio.activo,
  }))

  const staffUsuarios = usuarios.filter(usuario => usuario.rol === 'staff')
  const staffPorNegocio = new Map<string, UsuarioAdmin[]>()
  for (const staff of staffUsuarios) {
    if (!staff.negocio_id) continue
    const actuales = staffPorNegocio.get(staff.negocio_id) ?? []
    actuales.push(staff)
    staffPorNegocio.set(staff.negocio_id, actuales)
  }

  const staffParaAsignar = staffUsuarios.map(staff => ({
    id: staff.id,
    nombre: staff.nombre,
    email: staff.email,
    negocioNombreActual: staff.negocio_id
      ? (negociosPorId.get(staff.negocio_id)?.nombre ?? null)
      : null,
  }))

  return { negociosPorId, negociosOpciones, staffPorNegocio, staffParaAsignar }
}

/** Estado de Stripe Connect por negocio (hace llamadas a la API de Stripe). */
export async function cargarStripeStatus(negocios: NegocioAdmin[]): Promise<Map<string, StripeConnectStatus>> {
  const entries = await Promise.all(
    negocios.map(async (negocio) => {
      const status = await obtenerStripeStatus(negocio.stripe_account_id)
      return [negocio.id, status] as const
    })
  )
  return new Map(entries)
}

/** Historial de ajustes manuales de créditos (otorgados por admin). */
export async function cargarCreditosOtorgados(db: SupabaseClient): Promise<CreditoOtorgadoRow[]> {
  const consulta = await db
    .from('creditos_historial')
    .select('id, user_id, cantidad, motivo, created_at, otorgado_por, users(nombre, email)')
    .eq('otorgado_por', 'admin')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!consulta.error) {
    return (consulta.data ?? []) as unknown as CreditoOtorgadoRow[]
  }
  if (faltaColumnaExacta(consulta.error, 'otorgado_por')) {
    const fallback = await db
      .from('creditos_historial')
      .select('id, user_id, cantidad, motivo, created_at, users(nombre, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!fallback.error) {
      return ((fallback.data ?? []) as unknown as Omit<CreditoOtorgadoRow, 'otorgado_por'>[]).map((row) => ({
        ...row,
        otorgado_por: null,
      }))
    }
  }
  return []
}

export type FinanzasFiltros = {
  negocio?: string
  desde?: string
  hasta?: string
}

/** Bloque completo de cálculo financiero (ingresos, resumen semanal, pagos). */
export async function cargarFinanzas(db: SupabaseClient, negociosAfiliados: NegocioAdmin[], filtros: FinanzasFiltros = {}) {
  const negociosPorId = new Map(negociosAfiliados.map(n => [n.id, n]))

  const filtroFinanzasNegocio = typeof filtros.negocio === 'string' ? filtros.negocio.trim() : ''
  const filtroFinanzasDesde = esFechaISOValida(filtros.desde) ? filtros.desde : ''
  const filtroFinanzasHasta = esFechaISOValida(filtros.hasta) ? filtros.hasta : ''

  const inicioSemana = inicioSemanaCalendario(new Date())
  const finSemanaExclusivo = new Date(inicioSemana)
  finSemanaExclusivo.setDate(finSemanaExclusivo.getDate() + 7)
  const finSemanaIncluyente = new Date(finSemanaExclusivo)
  finSemanaIncluyente.setDate(finSemanaIncluyente.getDate() - 1)
  const inicioMes = inicioMesCalendario(new Date())
  const manana = new Date()
  manana.setHours(0, 0, 0, 0)
  manana.setDate(manana.getDate() + 1)

  const inicioSemanaISO = aFechaIsoDia(inicioSemana)
  const finSemanaExclusivoISO = aFechaIsoDia(finSemanaExclusivo)
  const finSemanaIncluyenteISO = aFechaIsoDia(finSemanaIncluyente)
  const inicioMesISO = aFechaIsoDia(inicioMes)
  const mananaISO = aFechaIsoDia(manana)

  const cargarVisitasPeriodo = async (
    inicioISO: string,
    finExclusivoISO: string,
    opciones: { incluyeEstado: boolean; incluyeMonto: boolean }
  ) => {
    let incluyeEstadoVisita = opciones.incluyeEstado
    let incluyeMontoVisita = opciones.incluyeMonto
    for (let intento = 0; intento < 3; intento += 1) {
      const columnas = ['id', 'negocio_id', 'fecha']
      if (incluyeMontoVisita) columnas.push('monto_negocio')
      if (incluyeEstadoVisita) columnas.push('estado')

      let consultaVisitas = db
        .from('visitas')
        .select(columnas.join(', '))
        .gte('fecha', inicioISO)
        .lt('fecha', finExclusivoISO)

      if (incluyeEstadoVisita) {
        // El check-in válido se guarda como 'asistio' (EstadoVisita), no 'completada'.
        consultaVisitas = consultaVisitas.eq('estado', 'asistio')
      }

      const resultadoVisitas = await consultaVisitas.returns<VisitaFinanzasRow[]>()
      if (!resultadoVisitas.error) {
        return { visitas: resultadoVisitas.data ?? [], incluyeEstadoVisita, incluyeMontoVisita, error: null as string | null }
      }
      if (incluyeEstadoVisita && faltaColumnaExacta(resultadoVisitas.error, 'estado')) {
        incluyeEstadoVisita = false
        continue
      }
      if (incluyeMontoVisita && faltaColumnaExacta(resultadoVisitas.error, 'monto_negocio')) {
        incluyeMontoVisita = false
        continue
      }
      return { visitas: [] as VisitaFinanzasRow[], incluyeEstadoVisita, incluyeMontoVisita, error: resultadoVisitas.error.message }
    }
    return { visitas: [] as VisitaFinanzasRow[], incluyeEstadoVisita, incluyeMontoVisita, error: null as string | null }
  }

  const resultadoVisitasSemana = await cargarVisitasPeriodo(inicioSemanaISO, finSemanaExclusivoISO, { incluyeEstado: true, incluyeMonto: true })
  const resultadoVisitasMes = await cargarVisitasPeriodo(inicioMesISO, mananaISO, {
    incluyeEstado: resultadoVisitasSemana.incluyeEstadoVisita,
    incluyeMonto: resultadoVisitasSemana.incluyeMontoVisita,
  })

  const visitasSemana = resultadoVisitasSemana.visitas
  const visitasMes = resultadoVisitasMes.visitas
  const incluyeMontoVisita = resultadoVisitasMes.incluyeMontoVisita
  let finanzasError: string | null = resultadoVisitasSemana.error ?? resultadoVisitasMes.error

  let pagosNegocios: PagoNegocioFinanzasRow[] = []
  const consultaPagosConFecha = await db
    .from('pagos_negocios')
    .select('id, negocio_id, periodo_inicio, periodo_fin, total_mxn, estado, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!consultaPagosConFecha.error) {
    pagosNegocios = ((consultaPagosConFecha.data ?? []) as PagoNegocioFinanzasRow[]).map(pago => ({
      ...pago,
      created_at: pago.created_at ?? null,
    }))
  } else if (faltaColumnaExacta(consultaPagosConFecha.error, 'created_at')) {
    const consultaPagosSinFecha = await db
      .from('pagos_negocios')
      .select('id, negocio_id, periodo_inicio, periodo_fin, total_mxn, estado')
      .order('periodo_fin', { ascending: false })
      .limit(1000)
    if (!consultaPagosSinFecha.error) {
      pagosNegocios = ((consultaPagosSinFecha.data ?? []) as Omit<PagoNegocioFinanzasRow, 'created_at'>[]).map(pago => ({
        ...pago,
        created_at: null,
      }))
    } else {
      finanzasError = finanzasError ?? consultaPagosSinFecha.error.message
    }
  } else {
    finanzasError = finanzasError ?? consultaPagosConFecha.error.message
  }

  const pagosPorNegocio = new Map<string, PagoNegocioFinanzasRow[]>()
  for (const pago of pagosNegocios) {
    const lista = pagosPorNegocio.get(pago.negocio_id) ?? []
    lista.push(pago)
    pagosPorNegocio.set(pago.negocio_id, lista)
  }
  for (const lista of pagosPorNegocio.values()) {
    lista.sort((a, b) => fechaPagoISO(b).localeCompare(fechaPagoISO(a)))
  }

  const visitasSemanaPorNegocio = new Map<string, VisitaFinanzasRow[]>()
  for (const visita of visitasSemana) {
    if (!visita.negocio_id) continue
    const lista = visitasSemanaPorNegocio.get(visita.negocio_id) ?? []
    lista.push(visita)
    visitasSemanaPorNegocio.set(visita.negocio_id, lista)
  }

  const visitasMesPorNegocio = new Map<string, number>()
  for (const visita of visitasMes) {
    if (!visita.negocio_id) continue
    const actual = visitasMesPorNegocio.get(visita.negocio_id) ?? 0
    visitasMesPorNegocio.set(visita.negocio_id, actual + 1)
  }

  const resumenSemanalNegocios = negociosAfiliados
    .map((negocio) => {
      const visitasNegocio = visitasSemanaPorNegocio.get(negocio.id) ?? []
      const planNegocio = (negocio.plan_negocio ?? negocio.nivel ?? 'basico') as NivelNegocio
      const tarifaFallback = tarifaNegocioPorCheckin({
        categoria: negocio.categoria,
        planNegocio,
        zona: negocio.zona ?? 'zona1',
        ciudad: negocio.ciudad,
      })
      const totalSemana = visitasNegocio.reduce((acc, visita) => {
        if (incluyeMontoVisita && typeof visita.monto_negocio === 'number' && Number.isFinite(visita.monto_negocio)) {
          return acc + visita.monto_negocio
        }
        return acc + tarifaFallback
      }, 0)
      const pagosNegocio = pagosPorNegocio.get(negocio.id) ?? []
      const ultimoPago = pagosNegocio.find(pago => pagoLiquidado(pago.estado)) ?? null
      const pagoSemanaActual = pagosNegocio.find(
        pago => pago.periodo_inicio === inicioSemanaISO && pago.periodo_fin === finSemanaIncluyenteISO
      ) ?? null
      return {
        negocio,
        visitasSemana: visitasNegocio.length,
        totalSemana,
        ultimoPago,
        estadoSemana: (pagoSemanaActual && pagoLiquidado(pagoSemanaActual.estado) ? 'Pagado' : 'Pendiente') as 'Pagado' | 'Pendiente',
      }
    })
    .sort((a, b) => {
      if (b.totalSemana !== a.totalSemana) return b.totalSemana - a.totalSemana
      if (b.visitasSemana !== a.visitasSemana) return b.visitasSemana - a.visitasSemana
      return a.negocio.nombre.localeCompare(b.negocio.nombre)
    })

  const totalSemanaNegocios = resumenSemanalNegocios.reduce((acc, row) => acc + row.totalSemana, 0)
  const pagosLiquidados = pagosNegocios.filter(pago => pagoLiquidado(pago.estado))
  const totalPagadoMes = pagosLiquidados.reduce((acc, pago) => {
    const fecha = fechaPagoISO(pago)
    return fecha >= inicioMesISO ? acc + aNumero(pago.total_mxn) : acc
  }, 0)
  const totalPagadoHistorico = pagosLiquidados.reduce((acc, pago) => acc + aNumero(pago.total_mxn), 0)

  let negocioMasVisitasMes: { nombre: string; visitas: number } | null = null
  for (const [negocioId, totalVisitas] of visitasMesPorNegocio.entries()) {
    const negocio = negociosPorId.get(negocioId)
    if (!negocio) continue
    if (!negocioMasVisitasMes || totalVisitas > negocioMasVisitasMes.visitas) {
      negocioMasVisitasMes = { nombre: negocio.nombre, visitas: totalVisitas }
    }
  }

  const promedioVisitasPorNegocio = negociosAfiliados.length > 0
    ? visitasMes.length / negociosAfiliados.length
    : 0

  const filtroFinanzasNegocioValido = filtroFinanzasNegocio && negociosPorId.has(filtroFinanzasNegocio)
    ? filtroFinanzasNegocio
    : ''

  const historialPagosFiltrado = pagosNegocios
    .filter((pago) => {
      if (filtroFinanzasNegocioValido && pago.negocio_id !== filtroFinanzasNegocioValido) return false
      const fecha = fechaPagoISO(pago)
      if (filtroFinanzasDesde && (!fecha || fecha < filtroFinanzasDesde)) return false
      if (filtroFinanzasHasta && (!fecha || fecha > filtroFinanzasHasta)) return false
      return true
    })
    .sort((a, b) => fechaPagoISO(b).localeCompare(fechaPagoISO(a)))

  return {
    finanzasError,
    inicioSemanaISO,
    finSemanaIncluyenteISO,
    inicioMesISO,
    visitasMes,
    pagosNegocios,
    resumenSemanalNegocios,
    totalSemanaNegocios,
    totalPagadoMes,
    totalPagadoHistorico,
    negocioMasVisitasMes,
    promedioVisitasPorNegocio,
    filtroFinanzasNegocio,
    filtroFinanzasNegocioValido,
    filtroFinanzasDesde,
    filtroFinanzasHasta,
    historialPagosFiltrado,
  }
}
