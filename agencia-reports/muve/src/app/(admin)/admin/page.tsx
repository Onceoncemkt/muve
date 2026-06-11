import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CIUDAD_LABELS, CIUDADES_OPERATIVAS, ZONA_NEGOCIO_LABELS } from '@/types'
import { normalizarCategoriasNegocio, tarifaNegocioPorCheckin } from '@/lib/planes'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import StaffNegocioAsignadoSelect from '@/components/admin/StaffNegocioAsignadoSelect'
import NegocioStaffAsignarSelect from '@/components/admin/NegocioStaffAsignarSelect'
import AdminUsuarioRolControl from '@/components/admin/AdminUsuarioRolControl'
import AdminUsuarioPlanToggle from '@/components/admin/AdminUsuarioPlanToggle'
import AdminDarCreditosModal from '@/components/admin/AdminDarCreditosModal'
import AdminInvitarUsuarioModal from '@/components/admin/AdminInvitarUsuarioModal'
import AdminInvitarNegocioForm from '@/components/admin/AdminInvitarNegocioForm'
import AdminReservacionesSection from '@/components/admin/AdminReservacionesSection'
import type { Ciudad, Categoria, NivelNegocio, Rol, ZonaNegocio } from '@/types'
import { obtenerRolServidor } from '@/lib/auth/server-role'
import { obtenerStripeStatus, type StripeConnectStatus } from '@/lib/stripe-connect'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type UsuarioAdmin = {
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

type NegocioAdmin = {
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
type CreditoOtorgadoRow = {
  id: string
  user_id: string
  cantidad: number
  motivo: string
  created_at: string
  otorgado_por: string | null
  users: {
    nombre: string
    email: string
  } | null
}
type VisitaFinanzasRow = {
  id: string
  negocio_id: string
  fecha: string
  monto_negocio?: number | null
  estado?: string | null
}
type PagoNegocioFinanzasRow = {
  id: string
  negocio_id: string
  periodo_inicio: string
  periodo_fin: string
  total_mxn: number | null
  estado: string | null
  created_at?: string | null
}

const CIUDADES: Ciudad[] = CIUDADES_OPERATIVAS
const CATEGORIAS: Categoria[] = ['gimnasio', 'clases', 'estetica', 'restaurante', 'clinica']
const CATEGORIA_FORM_LABELS: Record<Categoria, string> = {
  gimnasio: 'GYM',
  clases: 'CLASES',
  estetica: 'ESTÉTICAS Y SPA',
  restaurante: 'RESTAURANTE',
  clinica: 'CLÍNICA',
}
const ZONAS: ZonaNegocio[] = ['zona1', 'zona1_5', 'zona2']
const NIVELES: NivelNegocio[] = ['basico', 'plus', 'total']
const ZONA_LABELS: Record<ZonaNegocio, string> = ZONA_NEGOCIO_LABELS
const NIVEL_LABELS: Record<NivelNegocio, string> = {
  basico: 'Básico',
  plus: 'Plus',
  total: 'Total',
}
const CATEGORIA_TARIFA_LABELS: Record<Categoria, string> = {
  gimnasio: 'Gym',
  clases: 'Clases',
  estetica: 'Wellness',
  restaurante: 'Restaurante',
  clinica: 'Clínica',
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function faltaColumnaRequiereReserva(error: { message?: string } | null | undefined) {
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

function faltaColumnaEdad(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('edad')
}

function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('negocio_id')
}

function faltaColumnaExacta(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function normalizarEdad(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function calcularEdadDesdeFecha(fecha: unknown): number | null {
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
function formatearMonto(valor: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(valor)
}

function aNumero(valor: unknown) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string') {
    const parsed = Number(valor)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function aFechaIsoDia(fecha: Date) {
  return fecha.toISOString().slice(0, 10)
}

function inicioSemanaCalendario(fecha: Date) {
  const base = new Date(fecha)
  base.setHours(0, 0, 0, 0)
  const offsetLunes = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - offsetLunes)
  return base
}

function inicioMesCalendario(fecha: Date) {
  const base = new Date(fecha)
  base.setHours(0, 0, 0, 0)
  base.setDate(1)
  return base
}

function esFechaISOValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

function pagoLiquidado(estado: string | null | undefined) {
  const valor = (estado ?? '').toLowerCase()
  return valor === 'pagado' || valor === 'completado' || valor === 'paid' || valor === 'succeeded'
}

function fechaPagoISO(pago: PagoNegocioFinanzasRow) {
  if (typeof pago.created_at === 'string' && pago.created_at.trim()) {
    return pago.created_at.slice(0, 10)
  }
  if (typeof pago.periodo_fin === 'string' && pago.periodo_fin.trim()) {
    return pago.periodo_fin.slice(0, 10)
  }
  return ''
}

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return '—'
  const parsed = new Date(fecha)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    negocio_status?: string
    negocio_msg?: string
    finanzas_negocio?: string
    finanzas_desde?: string
    finanzas_hasta?: string
  }>
}) {
  const adminPreviewEnabled = process.env.NODE_ENV === 'development' && process.env.PREVIEW_ADMIN === 'true'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!adminPreviewEnabled) {
    if (!user) redirect('/login')
    const rolAdmin = await obtenerRolServidor(user)
    if (rolAdmin !== 'admin') redirect('/dashboard')
  }

  const params = await searchParams
  const negocioStatus = params.negocio_status === 'ok' || params.negocio_status === 'error'
    ? params.negocio_status
    : null
  const negocioMsg = params.negocio_msg?.trim() ?? ''
  const filtroFinanzasNegocio = typeof params.finanzas_negocio === 'string'
    ? params.finanzas_negocio.trim()
    : ''
  const filtroFinanzasDesde = esFechaISOValida(params.finanzas_desde) ? params.finanzas_desde : ''
  const filtroFinanzasHasta = esFechaISOValida(params.finanzas_hasta) ? params.finanzas_hasta : ''

  const db = admin()

  const consultasUsuarios = [
    {
      select: 'id, nombre, email, ciudad, rol, edad, plan_activo, creditos_extra, negocio_id, fecha_registro',
      incluyeNegocioId: true,
    },
    {
      select: 'id, nombre, email, ciudad, rol, plan_activo, creditos_extra, negocio_id, fecha_registro',
      incluyeNegocioId: true,
    },
    {
      select: 'id, nombre, email, ciudad, rol, edad, plan_activo, creditos_extra, fecha_registro',
      incluyeNegocioId: false,
    },
    {
      select: 'id, nombre, email, ciudad, rol, plan_activo, creditos_extra, fecha_registro',
      incluyeNegocioId: false,
    },
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

    const errorPorColumnaOpcional = (
      faltaColumnaEdad(resultado.error)
      || faltaColumnaNegocioId(resultado.error)
    )
    if (!errorPorColumnaOpcional) {
      break
    }
  }

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

  const authUsers = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const edadPorUsuario = new Map<string, number>()
  for (const authUser of authUsers.data?.users ?? []) {
    const metadata = authUser.user_metadata as Record<string, unknown> | undefined
    const edadMetadata = normalizarEdad(metadata?.edad)
      ?? normalizarEdad(metadata?.age)
      ?? calcularEdadDesdeFecha(metadata?.fecha_nacimiento)
      ?? calcularEdadDesdeFecha(metadata?.birthdate)

    if (edadMetadata) {
      edadPorUsuario.set(authUser.id, edadMetadata)
    }
  }

  const usuariosEnriquecidos = usuarios.map(usuario => ({
    ...usuario,
    edad: usuario.edad ?? edadPorUsuario.get(usuario.id) ?? null,
  }))

  const consultaCreditosOtorgados = await db
    .from('creditos_historial')
    .select('id, user_id, cantidad, motivo, created_at, otorgado_por, users(nombre, email)')
    .eq('otorgado_por', 'admin')
    .order('created_at', { ascending: false })
    .limit(100)

  const creditosOtorgados = consultaCreditosOtorgados.error
    ? []
    : (consultaCreditosOtorgados.data ?? []) as unknown as CreditoOtorgadoRow[]

  const stripeStatusEntries = await Promise.all(
    negociosAfiliados.map(async (negocio) => {
      const status = await obtenerStripeStatus(negocio.stripe_account_id)
      return [negocio.id, status] as const
    })
  )
  const stripeStatusPorNegocio = new Map<string, StripeConnectStatus>(stripeStatusEntries)

  const negociosPorId = new Map(negociosAfiliados.map(negocio => [negocio.id, negocio]))
  const negociosOpciones = negociosAfiliados.map(negocio => ({
    id: negocio.id,
    nombre: negocio.nombre,
    activo: negocio.activo,
  }))

  const staffUsuarios = usuariosEnriquecidos.filter(usuario => usuario.rol === 'staff')
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
        consultaVisitas = consultaVisitas.eq('estado', 'completada')
      }

      const resultadoVisitas = await consultaVisitas.returns<VisitaFinanzasRow[]>()
      if (!resultadoVisitas.error) {
        return {
          visitas: resultadoVisitas.data ?? [],
          incluyeEstadoVisita,
          incluyeMontoVisita,
          error: null as string | null,
        }
      }

      if (incluyeEstadoVisita && faltaColumnaExacta(resultadoVisitas.error, 'estado')) {
        incluyeEstadoVisita = false
        continue
      }

      if (incluyeMontoVisita && faltaColumnaExacta(resultadoVisitas.error, 'monto_negocio')) {
        incluyeMontoVisita = false
        continue
      }
      return {
        visitas: [] as VisitaFinanzasRow[],
        incluyeEstadoVisita,
        incluyeMontoVisita,
        error: resultadoVisitas.error.message,
      }
    }

    return {
      visitas: [] as VisitaFinanzasRow[],
      incluyeEstadoVisita,
      incluyeMontoVisita,
      error: null as string | null,
    }
  }

  const resultadoVisitasSemana = await cargarVisitasPeriodo(inicioSemanaISO, finSemanaExclusivoISO, {
    incluyeEstado: true,
    incluyeMonto: true,
  })
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
        estadoSemana: pagoSemanaActual && pagoLiquidado(pagoSemanaActual.estado) ? 'Pagado' : 'Pendiente' as 'Pagado' | 'Pendiente',
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-16 text-white">
      <div className="border-b border-white/10 px-4 py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin"
              className="text-lg font-black tracking-tight text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="#usuarios"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Clientes
              </a>
              <a
                href="#reservaciones"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Reservaciones
              </a>
              <a
                href="#finanzas"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Finanzas
              </a>
              <a
                href="#negocios"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Negocios
              </a>
              <Link
                href="/admin/preregistros"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Pre-registros
              </Link>
              <Link
                href="/admin"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Inicio
              </Link>
              <BotonCerrarSesion className="shrink-0" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#E8FF47]">Panel Admin</h1>
            <p className="mt-1 text-sm text-white/50">
              MUVET · {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </p>
            {adminPreviewEnabled && (
              <p className="mt-2 inline-flex rounded-md bg-[#E8FF47]/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E8FF47]">
                Preview local
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-4 py-6">
        <section id="usuarios" className="scroll-mt-24">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
                Clientes
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Gestión completa de clientes, staff y admins.
              </p>
            </div>
            <AdminInvitarUsuarioModal
              negocios={negociosAfiliados.map(negocio => ({ id: negocio.id, nombre: negocio.nombre }))}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full border-collapse bg-[#111111]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Ciudad</th>
                  <th className="px-3 py-3">Rol</th>
                  <th className="px-3 py-3">Edad</th>
                  <th className="px-3 py-3">Plan activo</th>
                  <th className="px-3 py-3">Créditos extra</th>
                  <th className="px-3 py-3">Negocio asignado</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosEnriquecidos.map(usuario => {
                  const negocioAsignado = usuario.negocio_id
                    ? negociosPorId.get(usuario.negocio_id)?.nombre ?? 'No disponible'
                    : 'Sin asignar'

                  return (
                    <tr key={usuario.id} className="border-b border-white/10 align-top text-sm text-white/90">
                      <td className="px-3 py-3 font-semibold">{usuario.nombre}</td>
                      <td className="px-3 py-3 text-white/70">{usuario.email}</td>
                      <td className="px-3 py-3">{CIUDAD_LABELS[usuario.ciudad]}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                            usuario.rol === 'admin'
                              ? 'bg-[#6B4FE8]/25 text-[#CBBEFF]'
                              : usuario.rol === 'staff'
                                ? 'bg-[#E8FF47]/20 text-[#E8FF47]'
                                : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-3 py-3">{usuario.edad ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            usuario.plan_activo
                              ? 'bg-[#E8FF47] text-[#0A0A0A]'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {usuario.plan_activo ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#E8FF47] font-bold">{usuario.creditos_extra ?? 0}</td>
                      <td className="px-3 py-3 text-white/75">{negocioAsignado}</td>
                      <td className="px-3 py-3">
                        <div className="min-w-[16rem] space-y-2">
                          <AdminUsuarioRolControl userId={usuario.id} rolActual={usuario.rol} />
                          <AdminUsuarioPlanToggle userId={usuario.id} planActivo={usuario.plan_activo} />
                          {usuario.rol === 'usuario' && (
                            <AdminDarCreditosModal userId={usuario.id} userNombre={usuario.nombre} />
                          )}
                          {usuario.rol === 'staff' && usuariosConNegocioIdDisponible && (
                            <StaffNegocioAsignadoSelect
                              userId={usuario.id}
                              negocioIdActual={usuario.negocio_id}
                              negocioActualNombre={usuario.negocio_id ? (negociosPorId.get(usuario.negocio_id)?.nombre ?? null) : null}
                              opciones={negociosOpciones}
                            />
                          )}
                          {usuario.rol === 'staff' && !usuariosConNegocioIdDisponible && (
                            <p className="text-[11px] font-semibold text-white/45">
                              Asignación de negocio no disponible en este esquema.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {usuariosEnriquecidos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-white/50">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="creditos-otorgados" className="scroll-mt-24">
          <div className="mb-3">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
              Historial de créditos otorgados
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Últimos créditos extra otorgados manualmente por administración.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full border-collapse bg-[#111111]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                  <th className="px-3 py-3">Usuario</th>
                  <th className="px-3 py-3">Cantidad</th>
                  <th className="px-3 py-3">Motivo</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Otorgado por</th>
                </tr>
              </thead>
              <tbody>
                {creditosOtorgados.map((row) => (
                  <tr key={row.id} className="border-b border-white/10 text-sm text-white/90">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{row.users?.nombre ?? 'Usuario no disponible'}</p>
                      <p className="text-xs text-white/55">{row.users?.email ?? row.user_id}</p>
                    </td>
                    <td className="px-3 py-3 font-black text-[#E8FF47]">+{row.cantidad}</td>
                    <td className="px-3 py-3">{row.motivo}</td>
                    <td className="px-3 py-3 text-white/75">
                      {new Date(row.created_at).toLocaleString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3 uppercase text-xs font-bold text-[#CBBEFF]">
                      {row.otorgado_por ?? 'admin'}
                    </td>
                  </tr>
                ))}
                {creditosOtorgados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                      No hay créditos otorgados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <AdminReservacionesSection />
        <section id="finanzas" className="scroll-mt-24">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
                Finanzas
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Resumen semanal, pagos por negocio e historial de transferencias.
              </p>
            </div>
            <p className="text-xs font-semibold text-white/50">
              Semana {formatearFecha(`${inicioSemanaISO}T00:00:00`)} · {formatearFecha(`${finSemanaIncluyenteISO}T00:00:00`)}
            </p>
          </div>

          {finanzasError && (
            <div className="mb-4 rounded-lg border border-[#6B4FE8]/40 bg-[#6B4FE8]/10 px-4 py-3 text-sm text-[#CBBEFF]">
              Algunas métricas financieras no se pudieron calcular: {finanzasError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                Total a pagar esta semana
              </p>
              <p className="mt-2 text-2xl font-black text-[#E8FF47]">
                {formatearMonto(totalSemanaNegocios)}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {resumenSemanalNegocios.reduce((acc, row) => acc + row.visitasSemana, 0)} visitas acumuladas.
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                Pagado a negocios este mes
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {formatearMonto(totalPagadoMes)}
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                Pagado histórico
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {formatearMonto(totalPagadoHistorico)}
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                Promedio visitas / negocio
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(promedioVisitasPorNegocio)}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {negocioMasVisitasMes
                  ? `Top del mes: ${negocioMasVisitasMes.nombre} (${negocioMasVisitasMes.visitas} visitas)`
                  : 'Sin visitas registradas este mes.'}
              </p>
            </article>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                Resumen semanal por negocio
              </h3>
              <p className="mt-1 text-xs text-white/50">
                Desglose de visitas y monto estimado por negocio para la semana actual.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full border-collapse bg-[#151515]">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                      <th className="px-3 py-2.5">Negocio</th>
                      <th className="px-3 py-2.5">Visitas</th>
                      <th className="px-3 py-2.5">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenSemanalNegocios.map((row) => (
                      <tr key={`resumen-${row.negocio.id}`} className="border-b border-white/10 text-sm text-white/90">
                        <td className="px-3 py-2.5 font-semibold">{row.negocio.nombre}</td>
                        <td className="px-3 py-2.5">{row.visitasSemana}</td>
                        <td className="px-3 py-2.5 text-[#E8FF47] font-bold">{formatearMonto(row.totalSemana)}</td>
                      </tr>
                    ))}
                    {resumenSemanalNegocios.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-sm text-white/50">
                          No hay negocios para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                Métricas generales
              </h3>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-lg border border-white/10 bg-[#151515] px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Negocio con más visitas del mes</p>
                  <p className="mt-1 font-semibold text-white">
                    {negocioMasVisitasMes ? negocioMasVisitasMes.nombre : 'Sin datos'}
                  </p>
                  <p className="text-xs text-white/55">
                    {negocioMasVisitasMes ? `${negocioMasVisitasMes.visitas} visitas` : '0 visitas'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#151515] px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Registros de pagos</p>
                  <p className="mt-1 font-semibold text-white">{pagosNegocios.length}</p>
                  <p className="text-xs text-white/55">
                    {historialPagosFiltrado.length} visibles con filtros actuales.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#111111] p-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
              Tabla de pagos por negocio
            </h3>
            <p className="mt-1 text-xs text-white/50">
              Visitas y monto de la semana actual, último pago realizado y estado de pago de esta semana.
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full border-collapse bg-[#151515]">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                    <th className="px-3 py-2.5">Negocio</th>
                    <th className="px-3 py-2.5">Visitas semana</th>
                    <th className="px-3 py-2.5">Monto semana</th>
                    <th className="px-3 py-2.5">Último pago</th>
                    <th className="px-3 py-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenSemanalNegocios.map((row) => {
                    const fechaUltimoPago = row.ultimoPago
                      ? formatearFecha(row.ultimoPago.created_at ?? `${row.ultimoPago.periodo_fin}T00:00:00`)
                      : '—'

                    return (
                      <tr key={`pago-${row.negocio.id}`} className="border-b border-white/10 text-sm text-white/90">
                        <td className="px-3 py-2.5 font-semibold">{row.negocio.nombre}</td>
                        <td className="px-3 py-2.5">{row.visitasSemana}</td>
                        <td className="px-3 py-2.5 text-[#E8FF47] font-bold">{formatearMonto(row.totalSemana)}</td>
                        <td className="px-3 py-2.5 text-white/75">
                          {row.ultimoPago ? (
                            <div>
                              <p className="font-semibold text-white">{formatearMonto(aNumero(row.ultimoPago.total_mxn))}</p>
                              <p className="text-xs text-white/55">{fechaUltimoPago}</p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                              row.estadoSemana === 'Pagado'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-yellow-500/20 text-yellow-200'
                            }`}
                          >
                            {row.estadoSemana}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {resumenSemanalNegocios.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                        No hay negocios para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#111111] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                  Historial de pagos
                </h3>
                <p className="mt-1 text-xs text-white/50">
                  Filtra por negocio y rango de fechas de pago.
                </p>
              </div>
              <form action="/admin" method="GET" className="grid w-full gap-2 sm:w-auto sm:grid-cols-4">
                <select
                  name="finanzas_negocio"
                  defaultValue={filtroFinanzasNegocioValido}
                  className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white outline-none focus:border-[#E8FF47]"
                >
                  <option value="">Todos los negocios</option>
                  {negociosAfiliados.map((negocio) => (
                    <option key={`filtro-finanzas-${negocio.id}`} value={negocio.id}>
                      {negocio.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  name="finanzas_desde"
                  defaultValue={filtroFinanzasDesde}
                  className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white outline-none focus:border-[#E8FF47]"
                />
                <input
                  type="date"
                  name="finanzas_hasta"
                  defaultValue={filtroFinanzasHasta}
                  className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white outline-none focus:border-[#E8FF47]"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-[#E8FF47] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]"
                  >
                    Filtrar
                  </button>
                  <Link
                    href="/admin#finanzas"
                    className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/75 hover:border-[#E8FF47] hover:text-[#E8FF47]"
                  >
                    Limpiar
                  </Link>
                </div>
              </form>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full border-collapse bg-[#151515]">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                    <th className="px-3 py-2.5">Negocio</th>
                    <th className="px-3 py-2.5">Periodo</th>
                    <th className="px-3 py-2.5">Total</th>
                    <th className="px-3 py-2.5">Fecha de pago</th>
                    <th className="px-3 py-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPagosFiltrado.map((pago) => {
                    const negocio = negociosPorId.get(pago.negocio_id)
                    const fecha = fechaPagoISO(pago)
                    const estado = pagoLiquidado(pago.estado) ? 'Pagado' : 'Pendiente'

                    return (
                      <tr key={`historial-pago-${pago.id}`} className="border-b border-white/10 text-sm text-white/90">
                        <td className="px-3 py-2.5 font-semibold">{negocio?.nombre ?? 'Negocio no disponible'}</td>
                        <td className="px-3 py-2.5 text-white/75">
                          {formatearFecha(`${pago.periodo_inicio}T00:00:00`)} · {formatearFecha(`${pago.periodo_fin}T00:00:00`)}
                        </td>
                        <td className="px-3 py-2.5 text-[#E8FF47] font-bold">{formatearMonto(aNumero(pago.total_mxn))}</td>
                        <td className="px-3 py-2.5 text-white/75">
                          {formatearFecha(fecha ? `${fecha}T00:00:00` : null)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                              estado === 'Pagado'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-yellow-500/20 text-yellow-200'
                            }`}
                          >
                            {estado}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {historialPagosFiltrado.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                        No hay pagos que coincidan con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="negocios" className="scroll-mt-24">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
                Negocios afiliados
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Estudios, gimnasios, estéticas y restaurantes.
              </p>
            </div>
            <p className="text-xs font-semibold text-white/50">
              {negociosAfiliados.length} registrados · solo los activos se muestran en /explorar
            </p>
          </div>

          {negocioStatus && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${
                negocioStatus === 'ok'
                  ? 'bg-[#E8FF47]/20 text-[#E8FF47] ring-1 ring-[#E8FF47]/40'
                  : 'bg-[#6B4FE8]/20 text-[#CBBEFF] ring-1 ring-[#6B4FE8]/40'
              }`}
            >
              {negocioMsg || (negocioStatus === 'ok' ? 'Operación realizada.' : 'No se pudo completar la operación.')}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5">
              <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                Lista de negocios existentes
              </h3>

              {negociosAfiliados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                  No hay negocios registrados.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {negociosAfiliados.map(negocio => {
                    const staffAsignado = staffPorNegocio.get(negocio.id) ?? []
                    const planActual = (negocio.plan_negocio ?? 'basico') as NivelNegocio
                    const categoriasNegocio = normalizarCategoriasNegocio(negocio.categorias, negocio.categoria)
                    const stripeStatus = stripeStatusPorNegocio.get(negocio.id) ?? 'no_account'
                    const planBadge = {
                      basico: { label: 'Básico', className: 'rounded-full bg-[#2A2A2A] px-2.5 py-0.5 text-[10px] font-bold tracking-[1px] text-white' },
                      plus: { label: 'Plus', className: 'rounded-full bg-[#6B4FE8] px-2.5 py-0.5 text-[10px] font-bold tracking-[1px] text-white' },
                      total: { label: 'Total', className: 'rounded-full bg-[#E8FF47] px-2.5 py-0.5 text-[10px] font-bold tracking-[1px] text-[#0A0A0A]' },
                    } as const
                    const plan = planBadge[planActual] ?? planBadge.basico
                    const categoriasRaw = (negocio.categorias ?? []) as string[]
                    const tieneGym = categoriasRaw.includes('gym') || categoriasRaw.includes('gimnasio')
                    const tieneClases = categoriasRaw.includes('clases')
                    const creditos = tieneGym
                      ? (
                        tieneClases
                          ? [{ label: 'Gym', creditos: '0.5' }, { label: 'Clases', creditos: '1' }]
                          : [{ label: 'Gym', creditos: '0.5' }]
                      )
                      : [{ label: CATEGORIA_TARIFA_LABELS[negocio.categoria], creditos: '1' }]
                    const categoriasCosto = categoriasNegocio.length > 0 ? categoriasNegocio : [negocio.categoria]
                    const tarifasPorCategoria = categoriasCosto.map((categoria) => {
                      const monto = tarifaNegocioPorCheckin({
                        categoria,
                        planNegocio: planActual,
                        zona: negocio.zona ?? 'zona1',
                        ciudad: negocio.ciudad,
                      })
                      return `${CATEGORIA_TARIFA_LABELS[categoria]} ${formatearMonto(monto)}`
                    })

                    return (
                      <article
                        key={negocio.id}
                        className="rounded-2xl border border-white/10 bg-[#151515] p-4 transition-colors hover:border-[#6B4FE8]/40"
                      >
                        <header className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-base font-black text-white">{negocio.nombre}</h4>
                            <p className="mt-0.5 truncate text-xs text-white/45">{negocio.direccion}</p>
                          </div>
                          <details className="shrink-0">
                            <summary className="cursor-pointer list-none rounded-md border border-white/15 px-2.5 py-1 text-base leading-none text-white/70 transition-colors hover:border-[#6B4FE8] hover:text-white">
                              ···
                            </summary>
                            <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                              <details>
                                <summary className="cursor-pointer list-none rounded-md border border-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#CBBEFF] hover:bg-[#6B4FE8]/20">
                                  Editar
                                </summary>
                                <div className="mt-2 max-w-full rounded-lg border border-white/10 bg-[#0A0A0A] p-3">
                                  <form
                                    method="POST"
                                    encType="multipart/form-data"
                                    action={`/api/admin/negocios/${negocio.id}`}
                                    className="grid gap-2 sm:grid-cols-2"
                                  >
                                    <input type="hidden" name="next" value="/admin" />
                                    <div className="sm:col-span-2">
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Nombre
                                      </label>
                                      <input
                                        type="text"
                                        name="nombre"
                                        required
                                        defaultValue={negocio.nombre}
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        URL del logo
                                      </label>
                                      <input
                                        type="url"
                                        name="logo_url"
                                        defaultValue={negocio.logo_url ?? ''}
                                        placeholder="https://..."
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      />
                                      <p className="mt-1 text-[10px] text-white/45">
                                        URL pública del logo para la landing.
                                      </p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <p className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Categorías
                                      </p>
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {CATEGORIAS.map(categoria => {
                                          const checked = categoriasNegocio.includes(categoria)
                                          const inputId = `edit-cat-${negocio.id}-${categoria}`
                                          return (
                                            <label
                                              key={categoria}
                                              htmlFor={inputId}
                                              className="flex items-center gap-2 rounded-md border border-white/10 bg-[#151515] px-2.5 py-2 text-xs text-white/85"
                                            >
                                              <input
                                                id={inputId}
                                                type="checkbox"
                                                name="categorias"
                                                value={categoria}
                                                defaultChecked={checked}
                                                className="h-4 w-4 accent-[#6B4FE8]"
                                              />
                                              {CATEGORIA_FORM_LABELS[categoria]}
                                            </label>
                                          )
                                        })}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Zona
                                      </label>
                                      <select
                                        name="zona"
                                        required
                                        defaultValue={negocio.zona ?? 'zona1'}
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      >
                                        {ZONAS.map(zona => (
                                          <option key={zona} value={zona}>
                                            {ZONA_LABELS[zona]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Plan (tarifa)
                                      </label>
                                      <select
                                        name="plan_negocio"
                                        required
                                        defaultValue={planActual}
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      >
                                        {NIVELES.map(plan => (
                                          <option key={plan} value={plan}>
                                            {NIVEL_LABELS[plan]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Ciudad
                                      </label>
                                      <select
                                        name="ciudad"
                                        required
                                        defaultValue={negocio.ciudad}
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      >
                                        {CIUDADES.map(ciudad => (
                                          <option key={ciudad} value={ciudad}>
                                            {CIUDAD_LABELS[ciudad]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Dirección
                                      </label>
                                      <input
                                        type="text"
                                        name="direccion"
                                        required
                                        defaultValue={negocio.direccion}
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Descripción
                                      </label>
                                      <textarea
                                        name="descripcion"
                                        defaultValue={negocio.descripcion ?? ''}
                                        rows={2}
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Instagram
                                      </label>
                                      <input
                                        type="text"
                                        name="instagram_handle"
                                        defaultValue={negocio.instagram_handle ?? ''}
                                        placeholder="usuario"
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        Foto del negocio
                                      </label>
                                      {negocio.imagen_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={negocio.imagen_url}
                                          alt={negocio.nombre}
                                          className="mb-2 h-28 w-full rounded-md border border-white/10 object-cover"
                                        />
                                      ) : (
                                        <p className="mb-2 text-[10px] text-white/45">Sin foto actual</p>
                                      )}
                                      <input
                                        type="file"
                                        name="foto_negocio"
                                        accept="image/*"
                                        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-[11px] text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]"
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <input
                                        id={`mostrar-landing-${negocio.id}`}
                                        type="checkbox"
                                        name="mostrar_en_landing"
                                        value="true"
                                        defaultChecked={negocio.mostrar_en_landing}
                                        className="h-4 w-4 accent-[#6B4FE8]"
                                      />
                                      <label
                                        htmlFor={`mostrar-landing-${negocio.id}`}
                                        className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-2.5 py-1.5 text-xs text-white/80"
                                      >
                                        Mostrar en landing de pre-registro
                                      </label>
                                      <p className="mt-1 text-[10px] text-white/45">
                                        Activa esto para que el logo aparezca en /preregistro.
                                      </p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <input
                                        id={`requiere-reserva-${negocio.id}`}
                                        type="checkbox"
                                        name="requiere_reserva"
                                        value="true"
                                        defaultChecked={negocio.requiere_reserva}
                                        className="peer h-4 w-4 accent-[#6B4FE8]"
                                      />
                                      <label
                                        htmlFor={`requiere-reserva-${negocio.id}`}
                                        className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-2.5 py-1.5 text-xs text-white/80"
                                      >
                                        Requiere reserva
                                      </label>
                                      <div className="mt-2 hidden peer-checked:block">
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Capacidad por clase
                                        </label>
                                        <input
                                          type="number"
                                          name="capacidad_default"
                                          min={1}
                                          defaultValue={negocio.capacidad_default ?? 10}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        />
                                      </div>
                                    </div>
                                    <div className="sm:col-span-2 flex justify-end">
                                      <button
                                        type="submit"
                                        className="rounded-md bg-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#5b40cd]"
                                      >
                                        Guardar cambios
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              </details>

                              <details>
                                <summary className="cursor-pointer list-none rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 hover:border-[#6B4FE8] hover:text-white">
                                  Ver pagos
                                </summary>
                                <div className="mt-2 rounded-lg border border-white/10 bg-[#0A0A0A] p-3 text-xs text-white/55">
                                  Próximamente: historial de transferencias semanales por negocio.
                                </div>
                              </details>

                              <form method="POST" action={`/api/admin/negocios/${negocio.id}/stripe-connect`}>
                                <input type="hidden" name="next" value="/admin" />
                                <button
                                  type="submit"
                                  className="w-full rounded-md bg-[#0A0A0A] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#E8FF47] hover:bg-[#222222]"
                                >
                                  {negocio.stripe_account_id ? 'Reconectar Stripe' : 'Conectar cuenta Stripe'}
                                </button>
                              </form>

                              <form method="POST" action={`/api/admin/negocios/${negocio.id}/toggle-activo`}>
                                <input type="hidden" name="next" value="/admin" />
                                <button
                                  type="submit"
                                  className={`w-full rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                    negocio.activo
                                      ? 'bg-[#6B4FE8] text-white hover:bg-[#5b40cd]'
                                      : 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#d8f03f]'
                                  }`}
                                >
                                  {negocio.activo ? 'Dar de baja' : 'Reactivar'}
                                </button>
                              </form>
                            </div>
                          </details>
                        </header>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {categoriasNegocio.map(categoria => (
                            <span key={`${negocio.id}-${categoria}`} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65 ring-1 ring-white/10">
                              {CATEGORIA_FORM_LABELS[categoria]}
                            </span>
                          ))}
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65 ring-1 ring-white/10">
                            {CIUDAD_LABELS[negocio.ciudad]}
                          </span>
                          <span className={plan.className}>
                            {plan.label}
                          </span>
                          {stripeStatus === 'active' && (
                            <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-300 ring-1 ring-green-500/40">
                              Stripe activo
                            </span>
                          )}
                          {stripeStatus === 'pending' && (
                            <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200 ring-1 ring-yellow-500/40">
                              Stripe pendiente
                            </span>
                          )}
                          {stripeStatus === 'no_account' && (
                            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50 ring-1 ring-white/10">
                              Stripe sin conectar
                            </span>
                          )}
                          {!negocio.activo && (
                            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55 ring-1 ring-white/15">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            background: '#1A1A1A',
                            border: '0.5px solid #2A2A2A',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            marginTop: '8px',
                          }}
                        >
                          {creditos.map((c) => (
                            <div
                              key={`${negocio.id}-credito-${c.label}`}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}
                            >
                              <span style={{ color: '#E8FF47', fontWeight: 700, fontSize: '13px' }}>{c.creditos}</span>
                              <span style={{ color: '#555', fontSize: '11px' }}>
                                crédito{c.creditos !== '1' ? 's' : ''} por visita · {c.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1 text-[11px] text-white/45">
                          {tarifasPorCategoria.join(' · ')}
                        </p>


                        {staffAsignado.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {staffAsignado.map(staff => (
                              <span
                                key={staff.id}
                                className="rounded-md bg-[#E8FF47]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E8FF47]"
                              >
                                {staff.nombre}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 border-t border-white/10 pt-3">
                          <NegocioStaffAsignarSelect
                            negocioId={negocio.id}
                            opciones={staffParaAsignar}
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
                <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                  Agregar negocio nuevo
                </h3>
                <form method="POST" encType="multipart/form-data" action="/api/admin/negocios" className="space-y-3">
                  <input type="hidden" name="next" value="/admin" />
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      required
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      URL del logo
                    </label>
                    <input
                      type="url"
                      name="logo_url"
                      placeholder="https://..."
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                    <p className="mt-1 text-[10px] text-white/45">
                      URL pública del logo (subir a Supabase Storage primero).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                        Categorías
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {CATEGORIAS.map(categoria => (
                          <label
                            key={categoria}
                            className="flex items-center gap-2 rounded-md border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white/85"
                          >
                            <input
                              type="checkbox"
                              name="categorias"
                              value={categoria}
                              className="h-4 w-4 accent-[#6B4FE8]"
                            />
                            {CATEGORIA_FORM_LABELS[categoria]}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-white/45">
                        Selecciona al menos una categoría.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                        Ciudad
                      </label>
                      <select
                        name="ciudad"
                        required
                        defaultValue=""
                        className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                      >
                        <option value="" disabled>Selecciona</option>
                        {CIUDADES.map(ciudad => (
                          <option key={ciudad} value={ciudad}>
                            {CIUDAD_LABELS[ciudad]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Zona
                    </label>
                    <select
                      name="zona"
                      required
                      defaultValue="zona1"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    >
                      {ZONAS.map(zona => (
                        <option key={zona} value={zona}>
                          {ZONA_LABELS[zona]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Nivel
                    </label>
                    <select
                      name="nivel"
                      required
                      defaultValue="basico"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    >
                      {NIVELES.map(nivel => (
                        <option key={nivel} value={nivel}>
                          {NIVEL_LABELS[nivel]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="direccion"
                      required
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Descripción
                    </label>
                    <textarea
                      name="descripcion"
                      rows={3}
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Instagram
                    </label>
                    <input
                      type="text"
                      name="instagram_handle"
                      placeholder="usuario"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Foto del negocio
                    </label>
                    <input
                      type="file"
                      name="foto_negocio"
                      accept="image/*"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]"
                    />
                  </div>

                  <div>
                    <input
                      id="nuevo-mostrar-landing"
                      type="checkbox"
                      name="mostrar_en_landing"
                      value="true"
                      className="h-4 w-4 accent-[#6B4FE8]"
                    />
                    <label
                      htmlFor="nuevo-mostrar-landing"
                      className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-3 py-1.5 text-sm text-white/80"
                    >
                      Mostrar en landing de pre-registro
                    </label>
                    <p className="mt-1 text-[10px] text-white/45">
                      Activa esto para que el logo aparezca en /preregistro.
                    </p>
                  </div>
                  <div>
                    <input
                      id="nuevo-requiere-reserva"
                      type="checkbox"
                      name="requiere_reserva"
                      value="true"
                      defaultChecked
                      className="peer h-4 w-4 accent-[#6B4FE8]"
                    />
                    <label
                      htmlFor="nuevo-requiere-reserva"
                      className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-3 py-1.5 text-sm text-white/80"
                    >
                      Requiere reserva
                    </label>
                    <div className="mt-2 hidden peer-checked:block">
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                        Capacidad por clase
                      </label>
                      <input
                        type="number"
                        name="capacidad_default"
                        min={1}
                        defaultValue={10}
                        className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-md bg-[#E8FF47] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]"
                  >
                    Agregar negocio
                  </button>
                </form>
              </div>

              <AdminInvitarNegocioForm
                negocios={negociosAfiliados.map(negocio => ({ id: negocio.id, nombre: negocio.nombre }))}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
