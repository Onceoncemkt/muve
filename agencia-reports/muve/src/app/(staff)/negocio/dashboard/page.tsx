'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import type { DiaSemana, EstadoReserva, PlanMembresia } from '@/types'
import { DIA_LABELS, formatHora } from '@/types'
import { normalizarCategoriaNegocio } from '@/lib/planes'

type UsuarioReserva = { id: string; nombre: string; email: string }
type HorarioReserva = {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  nombre_coach: string | null
  tipo_clase: string | null
}

interface ReservacionNegocio {
  id: string
  fecha: string
  estado: EstadoReserva | string
  created_at: string
  servicio_nombre?: string | null
  users: UsuarioReserva | UsuarioReserva[] | null
  horarios: HorarioReserva | HorarioReserva[] | null
}

interface CheckinHoy {
  id: string
  fecha: string
  user_id: string
  usuario_nombre: string
  usuario_email: string | null
}

interface ServicioDisponible {
  id: string
  nombre: string
  precio_normal_mxn: number
}

interface GrupoHorario {
  key: string
  horario: HorarioReserva | null
  reservaciones: ReservacionNegocio[]
}

interface NegocioDashboard {
  id: string
  nombre: string
  ciudad: string
  categoria: string
  imagen_url?: string | null
  instagram_handle?: string | null
  tiktok_handle?: string | null
  stripe_account_id?: string | null
  monto_maximo_visita?: number | null
  servicios_incluidos?: string | null
}

interface GananciasSemana {
  visitas_por_plan: Record<PlanMembresia, number>
  total_por_plan: Record<PlanMembresia, number>
  total_a_cobrar: number
}

interface GananciasHistoricoMes {
  mes: string
  visitas: number
  total_ganado: number
}

interface GananciasPayload {
  tarifas_por_plan: Record<PlanMembresia, number>
  semana: GananciasSemana
  historico_mensual: GananciasHistoricoMes[]
  nota: string
}

interface PagoSemanalPayload {
  periodo_inicio: string
  periodo_fin: string
  visitas_basico: number
  visitas_plus: number
  visitas_total: number
  total_mxn: number
  estado: 'pagado' | 'pendiente'
  stripe_transfer_id: string | null
  created_at: string | null
}

interface PagosPayload {
  historial_semanal: PagoSemanalPayload[]
  proximo_pago_estimado: PagoSemanalPayload
}

interface DashboardPayload {
  sin_negocio: boolean
  fecha: string
  negocio?: NegocioDashboard
  checkins_hoy?: CheckinHoy[]
  servicios_disponibles?: ServicioDisponible[]
  resumen?: {
    reservaciones_hoy: number
    checkins_hoy: number
    horarios_activos: number
  }
  ganancias?: GananciasPayload
  pagos?: PagosPayload
  reservaciones?: ReservacionNegocio[]
  error?: string
}

type ConfiguracionRestaurante = {
  servicio: string
  dias_activos: DiaSemana[]
}

const DIAS_SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const RESTAURANTE_CONFIG_PREFIX = '__MUVET_RESTAURANTE_CONFIG__'

function normalizarDiasActivosRestaurante(value: unknown): DiaSemana[] {
  if (!Array.isArray(value)) return [...DIAS_SEMANA]
  const resultado = value.filter((dia): dia is DiaSemana => (
    typeof dia === 'string' && DIAS_SEMANA.includes(dia as DiaSemana)
  ))
  return resultado.length > 0 ? Array.from(new Set(resultado)) : [...DIAS_SEMANA]
}

function configuracionRestauranteInicial(): ConfiguracionRestaurante {
  return {
    servicio: '',
    dias_activos: [...DIAS_SEMANA],
  }
}

function parseConfiguracionRestaurante(raw: string | null | undefined): ConfiguracionRestaurante {
  if (typeof raw !== 'string' || !raw.trim()) return configuracionRestauranteInicial()
  const limpio = raw.trim()
  const prefijo = `${RESTAURANTE_CONFIG_PREFIX}:`
  if (!limpio.startsWith(prefijo)) {
    return {
      servicio: limpio,
      dias_activos: [...DIAS_SEMANA],
    }
  }

  const payload = limpio.slice(prefijo.length).trim()
  if (!payload) return configuracionRestauranteInicial()

  try {
    const parsed = JSON.parse(payload) as {
      servicio?: unknown
      dias_activos?: unknown
    }
    return {
      servicio: typeof parsed.servicio === 'string' ? parsed.servicio.trim() : '',
      dias_activos: normalizarDiasActivosRestaurante(parsed.dias_activos),
    }
  } catch {
    return {
      servicio: payload,
      dias_activos: [...DIAS_SEMANA],
    }
  }
}

function serializarConfiguracionRestaurante(config: ConfiguracionRestaurante) {
  return `${RESTAURANTE_CONFIG_PREFIX}:${JSON.stringify({
    servicio: config.servicio.trim(),
    dias_activos: normalizarDiasActivosRestaurante(config.dias_activos),
  })}`
}

function hoyLocalISO() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

function obtenerRelacion<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function claseEstado(estado: string) {
  if (estado === 'confirmada') return 'bg-[#E8FF47]/30 text-[#0A0A0A]'
  if (estado === 'completada') return 'bg-green-100 text-green-800'
  return 'bg-red-100 text-red-700'
}

function inicialesNegocio(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(fragmento => fragmento[0]?.toUpperCase() ?? '')
    .join('')
}
const PLAN_LABELS: Record<PlanMembresia, string> = {
  basico: 'Básico',
  plus: 'Plus',
  total: 'Total',
}


const PLANES_MEMBRESIA: PlanMembresia[] = ['basico', 'plus', 'total']

function gananciasIniciales(): GananciasPayload {
  return {
    tarifas_por_plan: {
      basico: 60,
      plus: 65,
      total: 70,
    },
    semana: {
      visitas_por_plan: {
        basico: 0,
        plus: 0,
        total: 0,
      },
      total_por_plan: {
        basico: 0,
        plus: 0,
        total: 0,
      },
      total_a_cobrar: 0,
    },
    historico_mensual: [],
    nota: 'MUVET hace corte, y te paga el total acumulado cada semana',
  }
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

function pagoSemanalInicial(): PagoSemanalPayload {
  const inicio = inicioSemanaLocal(new Date())
  const fin = finSemanaLocal(inicio)
  return {
    periodo_inicio: formatoFechaISO(inicio),
    periodo_fin: formatoFechaISO(fin),
    visitas_basico: 0,
    visitas_plus: 0,
    visitas_total: 0,
    total_mxn: 0,
    estado: 'pendiente',
    stripe_transfer_id: null,
    created_at: null,
  }
}

function pagosIniciales(): PagosPayload {
  return {
    historial_semanal: [],
    proximo_pago_estimado: pagoSemanalInicial(),
  }
}

function formatMonedaMXN(valor: number) {
  return `$${valor.toLocaleString('es-MX')}`
}

function claseEstadoPago(estado: 'pagado' | 'pendiente') {
  return estado === 'pagado'
    ? 'bg-[#E8FF47] text-[#0A0A0A]'
    : 'bg-[#6B4FE8]/30 text-[#E5DEFF]'
}
function etiquetaEstadoPago(estado: 'pagado' | 'pendiente') {
  return estado === 'pagado' ? 'Pagado' : 'Pendiente'
}

function formatFechaCorta(fechaISO: string) {
  const fecha = new Date(`${fechaISO}T00:00:00`)
  if (Number.isNaN(fecha.getTime())) return fechaISO
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function formatPeriodoSemanal(inicio: string, fin: string) {
  return `${formatFechaCorta(inicio)} - ${formatFechaCorta(fin)}`
}

function formatHoraCheckin(fechaISO: string) {
  const fecha = new Date(fechaISO)
  if (Number.isNaN(fecha.getTime())) return '--:--'
  return fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function obtenerMensajeFlashDesdeQuery(params: URLSearchParams) {
  const estado = params.get('status') ?? params.get('stripe_status')
  const texto = (params.get('msg')?.trim() ?? '') || (params.get('stripe_msg')?.trim() ?? '')
  if (!texto || (estado !== 'ok' && estado !== 'error')) return null

  return {
    tipo: estado === 'ok' ? 'ok' : 'error',
    texto,
  } as const
}


export default function NegocioDashboardPage() {
  const [fechaHoy] = useState(hoyLocalISO())
  const [negocio, setNegocio] = useState<NegocioDashboard | null>(null)
  const [checkinsHoy, setCheckinsHoy] = useState<CheckinHoy[]>([])
  const [serviciosDisponibles, setServiciosDisponibles] = useState<ServicioDisponible[]>([])
  const [reservaciones, setReservaciones] = useState<ReservacionNegocio[]>([])
  const [resumen, setResumen] = useState({ reservaciones_hoy: 0, checkins_hoy: 0, horarios_activos: 0 })
  const [ganancias, setGanancias] = useState<GananciasPayload>(gananciasIniciales())
  const [pagos, setPagos] = useState<PagosPayload>(pagosIniciales())
  const [sinNegocio, setSinNegocio] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [completandoId, setCompletandoId] = useState<string | null>(null)
  const [montoMaximoRestauranteDraft, setMontoMaximoRestauranteDraft] = useState('0')
  const [configuracionRestaurante, setConfiguracionRestaurante] = useState<ConfiguracionRestaurante>(
    configuracionRestauranteInicial()
  )
  const [guardandoConfiguracionRestaurante, setGuardandoConfiguracionRestaurante] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return obtenerMensajeFlashDesdeQuery(params)
  })

  const cargarDashboard = useCallback(async () => {
    setCargando(true)

    try {
      const res = await fetch(`/api/negocio/dashboard?fecha=${encodeURIComponent(fechaHoy)}`)
      const data = (await res.json().catch(() => ({}))) as DashboardPayload

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar datos del panel' })
        setNegocio(null)
        setCheckinsHoy([])
        setServiciosDisponibles([])
        setMontoMaximoRestauranteDraft('0')
        setConfiguracionRestaurante(configuracionRestauranteInicial())
        setSinNegocio(false)
        setReservaciones([])
        setResumen({ reservaciones_hoy: 0, checkins_hoy: 0, horarios_activos: 0 })
        setGanancias(gananciasIniciales())
        setPagos(pagosIniciales())
        return
      }
      const negocioPerfil = data.negocio ?? null

      if (data.sin_negocio) {
        setSinNegocio(true)
        setNegocio(null)
        setCheckinsHoy([])
        setServiciosDisponibles([])
        setMontoMaximoRestauranteDraft('0')
        setConfiguracionRestaurante(configuracionRestauranteInicial())
        setReservaciones([])
        setResumen({ reservaciones_hoy: 0, checkins_hoy: 0, horarios_activos: 0 })
        setGanancias(data.ganancias ?? gananciasIniciales())
        setPagos(data.pagos ?? pagosIniciales())
        return
      }

      setSinNegocio(false)
      setNegocio(negocioPerfil)
      setCheckinsHoy((data.checkins_hoy ?? []) as CheckinHoy[])
      setServiciosDisponibles((data.servicios_disponibles ?? []) as ServicioDisponible[])
      setMontoMaximoRestauranteDraft(String(
        typeof negocioPerfil?.monto_maximo_visita === 'number'
          ? Math.max(Math.trunc(negocioPerfil.monto_maximo_visita), 0)
          : 0
      ))
      setConfiguracionRestaurante(parseConfiguracionRestaurante(negocioPerfil?.servicios_incluidos))
      setReservaciones((data.reservaciones ?? []) as ReservacionNegocio[])
      setResumen({
        reservaciones_hoy: data.resumen?.reservaciones_hoy ?? 0,
        checkins_hoy: data.resumen?.checkins_hoy ?? 0,
        horarios_activos: data.resumen?.horarios_activos ?? 0,
      })
      setGanancias(data.ganancias ?? gananciasIniciales())
      setPagos(data.pagos ?? pagosIniciales())
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar el panel' })
      setNegocio(null)
      setCheckinsHoy([])
      setServiciosDisponibles([])
      setMontoMaximoRestauranteDraft('0')
      setConfiguracionRestaurante(configuracionRestauranteInicial())
      setSinNegocio(false)
      setReservaciones([])
      setResumen({ reservaciones_hoy: 0, checkins_hoy: 0, horarios_activos: 0 })
      setGanancias(gananciasIniciales())
      setPagos(pagosIniciales())
    } finally {
      setCargando(false)
    }
  }, [fechaHoy])

  useEffect(() => {
    const id = setTimeout(() => {
      void cargarDashboard()
    }, 0)
    return () => clearTimeout(id)
  }, [cargarDashboard])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const mensajeFlash = obtenerMensajeFlashDesdeQuery(params)
    if (!mensajeFlash) return

    const url = new URL(window.location.href)
    url.searchParams.delete('status')
    url.searchParams.delete('msg')
    url.searchParams.delete('stripe_status')
    url.searchParams.delete('stripe_msg')
    window.history.replaceState({}, '', url.toString())
  }, [])

  async function completarReservacion(reservacionId: string) {
    setCompletandoId(reservacionId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/reservaciones/${reservacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'completada' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo completar la reservación' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Asistencia marcada como completada' })
        void cargarDashboard()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al completar reservación' })
    } finally {
      setCompletandoId(null)
    }
  }


  function toggleDiaActivoRestaurante(dia: DiaSemana) {
    setConfiguracionRestaurante((prev) => {
      const activo = prev.dias_activos.includes(dia)
      return {
        ...prev,
        dias_activos: activo
          ? prev.dias_activos.filter((item) => item !== dia)
          : [...prev.dias_activos, dia],
      }
    })
  }

  async function guardarConfiguracionRestaurante(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!negocio) return

    const montoMaximo = Number.parseInt(montoMaximoRestauranteDraft, 10)
    if (!Number.isFinite(montoMaximo) || montoMaximo < 0) {
      setMensaje({ tipo: 'error', texto: 'El monto máximo debe ser un entero mayor o igual a 0' })
      return
    }

    const servicio = configuracionRestaurante.servicio.trim()
    if (!servicio) {
      setMensaje({ tipo: 'error', texto: 'Especifica el servicio o beneficio a otorgar' })
      return
    }

    const diasActivos = normalizarDiasActivosRestaurante(configuracionRestaurante.dias_activos)
    if (diasActivos.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Selecciona al menos un día activo' })
      return
    }

    const serviciosIncluidosSerializado = serializarConfiguracionRestaurante({
      servicio,
      dias_activos: diasActivos,
    })

    setGuardandoConfiguracionRestaurante(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/negocio/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: negocio.id,
          monto_maximo_visita: montoMaximo,
          servicios_incluidos: serviciosIncluidosSerializado,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudo actualizar la configuración del restaurante',
        })
        return
      }

      setNegocio((prev) => prev ? {
        ...prev,
        monto_maximo_visita: montoMaximo,
        servicios_incluidos: serviciosIncluidosSerializado,
      } : prev)
      setConfiguracionRestaurante({
        servicio,
        dias_activos: diasActivos,
      })
      setMontoMaximoRestauranteDraft(String(montoMaximo))
      setMensaje({ tipo: 'ok', texto: 'Configuración de restaurante guardada correctamente' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al guardar la configuración del restaurante' })
    } finally {
      setGuardandoConfiguracionRestaurante(false)
    }
  }

  const gruposPorHorario = useMemo(() => {
    const mapa = new Map<string, GrupoHorario>()

    for (const reservacion of reservaciones) {
      const horario = obtenerRelacion(reservacion.horarios)
      const key = horario?.id ?? `sin-horario-${reservacion.id}`
      const existente = mapa.get(key)
      if (existente) {
        existente.reservaciones.push(reservacion)
      } else {
        mapa.set(key, { key, horario, reservaciones: [reservacion] })
      }
    }

    return Array.from(mapa.values())
      .map(grupo => ({
        ...grupo,
        reservaciones: [...grupo.reservaciones].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a, b) => {
        if (!a.horario && !b.horario) return 0
        if (!a.horario) return 1
        if (!b.horario) return -1
        return a.horario.hora_inicio.localeCompare(b.horario.hora_inicio)
      })
  }, [reservaciones])
  const categoriaNegocio = normalizarCategoriaNegocio(negocio?.categoria)
  const esRestaurante = categoriaNegocio === 'restaurante'
  const esGimnasio = categoriaNegocio === 'gimnasio'
  const esEstetica = categoriaNegocio === 'estetica' || serviciosDisponibles.length > 0
  const esClases = !esRestaurante && !esGimnasio && !esEstetica
  const totalVisitasSemana = PLANES_MEMBRESIA.reduce(
    (acumulado, plan) => acumulado + (ganancias.semana.visitas_por_plan[plan] ?? 0),
    0
  )
  const tarifaFijaPorCheckin = ganancias.tarifas_por_plan.basico ?? 0
  const gananciasSemanaTarifaFija = totalVisitasSemana * tarifaFijaPorCheckin
  const fechaProximoPago = useMemo(() => {
    const fechaBase = new Date(`${fechaHoy}T00:00:00`)
    const inicioSemana = inicioSemanaLocal(fechaBase)
    const proximoLunes = new Date(inicioSemana)
    proximoLunes.setDate(proximoLunes.getDate() + 7)
    return proximoLunes
  }, [fechaHoy])
  const desglosePagoActual = useMemo(() => {
    if (esClases) {
      return PLANES_MEMBRESIA.map((plan) => {
        const visitas = ganancias.semana.visitas_por_plan[plan] ?? 0
        const tarifa = ganancias.tarifas_por_plan[plan] ?? 0
        return {
          id: plan,
          etiqueta: `clases ${PLAN_LABELS[plan].toLowerCase()}`,
          formula: `${visitas} × ${formatMonedaMXN(tarifa)}`,
          total: visitas * tarifa,
        }
      })
    }

    const etiqueta = esGimnasio
      ? 'gimnasio'
      : esEstetica
        ? 'estetica'
        : 'restaurante'

    return [{
      id: etiqueta,
      etiqueta,
      formula: `${totalVisitasSemana} × ${formatMonedaMXN(tarifaFijaPorCheckin)}`,
      total: totalVisitasSemana * tarifaFijaPorCheckin,
    }]
  }, [esClases, esEstetica, esGimnasio, ganancias.semana.visitas_por_plan, ganancias.tarifas_por_plan, tarifaFijaPorCheckin, totalVisitasSemana])

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/negocio/dashboard"
              className="text-xs font-bold uppercase tracking-widest text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-white">Panel de negocio</h1>
            <p className="mt-1 text-sm text-white/40">
              {esRestaurante
                ? 'Control de entradas y resumen de visitas del restaurante'
                : esEstetica
                  ? 'Reservaciones wellness y servicios disponibles'
                  : esGimnasio
                    ? 'Check-ins diarios y ganancias del gimnasio'
                    : 'Horarios, reservaciones y operación de clases'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/negocio/dashboard"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Inicio
            </Link>
            <Link
              href="/negocio/horarios"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Horarios
            </Link>
            <Link
              href="/negocio/perfil"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Perfil
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-xs font-semibold text-[#555]">
          Hoy: {new Date(`${fechaHoy}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>

        {mensaje && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${
              mensaje.tipo === 'ok'
                ? 'bg-[#E8FF47]/20 text-[#0A0A0A] ring-1 ring-[#E8FF47]'
                : 'bg-red-50 text-red-700 ring-1 ring-red-200'
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {sinNegocio && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A]">
              Tu cuenta aún no tiene un negocio asignado. Contacta al administrador.
            </p>
          </div>
        )}

        {!sinNegocio && negocio && (
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {(esRestaurante || esGimnasio) && (
              <>
                <div className={`rounded-xl border border-[#E5E5E5] bg-white p-4 ${esGimnasio ? 'md:col-span-3' : 'md:col-span-2'}`}>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Check-ins del día</p>
                  <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{checkinsHoy.length}</p>
                  {checkinsHoy.length === 0 ? (
                    <p className="mt-2 text-sm text-[#666]">Aún no hay entradas validadas hoy.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {checkinsHoy.map((checkin) => (
                        <li
                          key={checkin.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2"
                        >
                          <p className="truncate text-sm font-bold text-[#0A0A0A]">{checkin.usuario_nombre}</p>
                          <span className="shrink-0 text-xs font-semibold text-[#6B4FE8]">
                            {formatHoraCheckin(checkin.fecha)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {esRestaurante && (
                  <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Visitas de la semana</p>
                    <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{totalVisitasSemana}</p>
                  </div>
                )}

                <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Ganancias</p>
                  <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{formatMonedaMXN(gananciasSemanaTarifaFija)}</p>
                  <p className="mt-1 text-xs text-[#666]">
                    {totalVisitasSemana} × {formatMonedaMXN(tarifaFijaPorCheckin)}
                  </p>
                </div>
              </>
            )}

            {esRestaurante && (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">
                  Configuración de beneficio restaurante
                </p>
                <p className="mt-1 text-xs text-[#666]">
                  Personaliza monto, servicio y días activos. No necesitas definir horarios por hora.
                </p>

                <form onSubmit={guardarConfiguracionRestaurante} className="mt-3 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#555]">
                        Monto máximo por visita (MXN)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={montoMaximoRestauranteDraft}
                        onChange={(event) => setMontoMaximoRestauranteDraft(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#555]">
                        Servicio o beneficio a otorgar
                      </span>
                      <input
                        type="text"
                        value={configuracionRestaurante.servicio}
                        onChange={(event) => setConfiguracionRestaurante((prev) => ({ ...prev, servicio: event.target.value }))}
                        placeholder="Ej. Hasta $150 en consumo o combo de cortesía"
                        className="mt-1 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#555]">Días activos</p>
                    <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
                      {DIAS_SEMANA.map((dia) => {
                        const activo = configuracionRestaurante.dias_activos.includes(dia)
                        return (
                          <button
                            key={dia}
                            type="button"
                            onClick={() => toggleDiaActivoRestaurante(dia)}
                            className={`rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                              activo
                                ? 'border-[#6B4FE8] bg-[#6B4FE8]/10 text-[#6B4FE8]'
                                : 'border-[#E5E5E5] bg-white text-[#666] hover:border-[#6B4FE8] hover:text-[#6B4FE8]'
                            }`}
                          >
                            {DIA_LABELS[dia]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={guardandoConfiguracionRestaurante}
                    className="rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {guardandoConfiguracionRestaurante ? 'Guardando...' : 'Guardar configuración restaurante'}
                  </button>
                </form>
              </div>
            )}

            {esEstetica && (
              <>
                <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Reservaciones del día</p>
                  <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{reservaciones.length}</p>
                  {reservaciones.length === 0 ? (
                    <p className="mt-2 text-sm text-[#666]">Aún no hay reservaciones wellness para hoy.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {reservaciones.map((reservacion) => {
                        const usuario = obtenerRelacion(reservacion.users)
                        const horario = obtenerRelacion(reservacion.horarios)
                        return (
                          <li
                            key={reservacion.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-[#0A0A0A]">{usuario?.nombre ?? 'Usuario'}</p>
                              <p className="truncate text-[11px] text-[#666]">{reservacion.servicio_nombre ?? 'Servicio no especificado'}</p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-[#6B4FE8]">
                              {horario ? formatHora(horario.hora_inicio) : '--:--'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Visitas de la semana</p>
                  <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{totalVisitasSemana}</p>
                </div>

                <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Ganancias</p>
                  <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{formatMonedaMXN(gananciasSemanaTarifaFija)}</p>
                  <p className="mt-1 text-xs text-[#666]">
                    {totalVisitasSemana} × {formatMonedaMXN(tarifaFijaPorCheckin)}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">
                    Servicios disponibles
                  </p>
                  {serviciosDisponibles.length === 0 ? (
                    <p className="mt-2 text-sm text-[#666]">
                      Este negocio aún no tiene servicios activos publicados.
                    </p>
                  ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {serviciosDisponibles.map((servicio) => (
                        <li
                          key={servicio.id}
                          className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-sm font-semibold text-[#0A0A0A]"
                        >
                          {servicio.nombre}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href="/negocio/perfil#servicios-disponibles"
                    className="mt-3 inline-flex rounded-lg border border-[#6B4FE8] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white"
                  >
                    Editar servicios disponibles
                  </Link>
                </div>
              </>
            )}

            {esClases && (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Mi negocio</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <div className="h-28 w-full overflow-hidden rounded-lg border border-[#E5E5E5] sm:w-40">
                    {negocio.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={negocio.imagen_url}
                        alt={negocio.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#6B4FE8] text-3xl font-black tracking-tight text-[#E8FF47]">
                        {inicialesNegocio(negocio.nombre)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-lg font-black text-[#0A0A0A]">{negocio.nombre}</p>
                    <p className="text-xs text-[#666]">
                      {negocio.ciudad.charAt(0).toUpperCase() + negocio.ciudad.slice(1)} · {negocio.categoria}
                    </p>
                    <Link
                      href="/negocio/perfil"
                      className="mt-3 inline-flex rounded-lg border border-[#6B4FE8] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white"
                    >
                      Editar perfil del negocio
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {esClases && (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Reservaciones del día</p>
                <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{resumen.reservaciones_hoy}</p>
              </div>
            )}

            {esClases && (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Horarios activos</p>
                <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{resumen.horarios_activos}</p>
              </div>
            )}
            <div className="md:col-span-4 space-y-3">
              <div className="rounded-xl border border-[#D5E63A] bg-[#E8FF47] p-5 text-[#0A0A0A]">
                <p className="text-[11px] font-black uppercase tracking-widest">Pago acumulado actual</p>
                <div className="mt-3 space-y-2">
                  {desglosePagoActual.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 rounded-lg border border-[#CFDF3D] bg-[#F3FF95] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold uppercase tracking-wide text-[#0A0A0A]">
                        {item.etiqueta}: {item.formula}
                      </span>
                      <span className="font-black text-[#0A0A0A]">= {formatMonedaMXN(item.total)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-3xl font-black tracking-tight">
                  A cobrar este lunes: {formatMonedaMXN(ganancias.semana.total_a_cobrar)}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#0A0A0A]/70">
                  Próximo pago: lunes {fechaProximoPago.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="rounded-xl bg-[#0A0A0A] p-5 text-white">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#E8FF47]">Historial de pagos</p>
                {pagos.historial_semanal.length === 0 ? (
                  <p className="mt-3 text-sm text-white/70">Tu primer pago llegará el próximo lunes</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/20 text-left text-[11px] font-black uppercase tracking-widest text-white/60">
                          <th className="px-2 py-2">Semana (del - al)</th>
                          <th className="px-2 py-2">Visitas totales</th>
                          <th className="px-2 py-2 text-right">Monto pagado</th>
                          <th className="px-2 py-2 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.historial_semanal.map((fila) => {
                          const totalVisitas = fila.visitas_basico + fila.visitas_plus + fila.visitas_total
                          return (
                            <tr key={`${fila.periodo_inicio}-${fila.periodo_fin}`} className="border-b border-white/10 text-white">
                              <td className="px-2 py-2 font-semibold">
                                {formatPeriodoSemanal(fila.periodo_inicio, fila.periodo_fin)}
                              </td>
                              <td className="px-2 py-2">{totalVisitas}</td>
                              <td className="px-2 py-2 text-right font-black">{formatMonedaMXN(fila.total_mxn)}</td>
                              <td className="px-2 py-2 text-right">
                                <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide ${claseEstadoPago(fila.estado)}`}>
                                  {etiquetaEstadoPago(fila.estado)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#888]">Escáner QR</p>
              <Link
                href="/validar"
                className="inline-flex rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222]"
              >
                Abrir escáner QR
              </Link>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Perfil del negocio</p>
              <p className="mt-1 text-xs text-[#666]">
                Administra información comercial, redes, contacto, foto y Stripe en una pantalla dedicada.
              </p>
              <Link
                href="/negocio/perfil"
                className="mt-3 inline-flex rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222]"
              >
                Ir a perfil del negocio
              </Link>
            </div>
          </section>
        )}

        {esClases && cargando && <p className="text-center text-sm text-[#888]">Cargando reservaciones...</p>}

        {esClases && !cargando && !sinNegocio && negocio && gruposPorHorario.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A]">Sin reservaciones para hoy</p>
            <p className="mt-1 text-xs text-[#888]">{negocio.nombre} no tiene reservaciones confirmadas/completadas hoy.</p>
          </div>
        )}
        {esClases && !cargando && gruposPorHorario.length > 0 && (
          <div className="space-y-3">
            {gruposPorHorario.map(grupo => (
              <section key={grupo.key} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#0A0A0A]">
                      {grupo.horario
                        ? `${formatHora(grupo.horario.hora_inicio)} – ${formatHora(grupo.horario.hora_fin)}`
                        : 'Horario no disponible'}
                    </h2>
                    {grupo.horario?.tipo_clase && (
                      <p className="mt-1 text-xs font-semibold text-[#444]">
                        Clase: {grupo.horario.tipo_clase}
                      </p>
                    )}
                    {grupo.horario?.nombre_coach && (
                      <p className="text-xs text-[#666]">
                        Coach: {grupo.horario.nombre_coach}
                      </p>
                    )}
                  </div>
                  <span className="rounded-md bg-[#F7F7F7] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#666]">
                    {grupo.reservaciones.length} reservaciones
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {grupo.reservaciones.map(reservacion => {
                    const usuario = obtenerRelacion(reservacion.users)
                    const horario = obtenerRelacion(reservacion.horarios)
                    return (
                      <div key={reservacion.id} className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#0A0A0A]">{usuario?.nombre ?? 'Usuario'}</p>
                          <p className="text-xs text-[#888]">
                            {horario
                              ? `${formatHora(horario.hora_inicio)} – ${formatHora(horario.hora_fin)}`
                              : 'Horario no disponible'}
                          </p>
                          {horario?.tipo_clase && (
                            <p className="text-[11px] text-[#666]">Tipo: {horario.tipo_clase}</p>
                          )}
                          {horario?.nombre_coach && (
                            <p className="text-[11px] text-[#666]">Coach: {horario.nombre_coach}</p>
                          )}
                        </div>
                        {reservacion.estado === 'confirmada' && (
                          <button
                            onClick={() => completarReservacion(reservacion.id)}
                            disabled={completandoId === reservacion.id}
                            className="shrink-0 rounded-md bg-[#0A0A0A] px-2.5 py-1 text-[10px] font-bold uppercase text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                          >
                            {completandoId === reservacion.id ? 'Procesando' : 'Completar'}
                          </button>
                        )}
                        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${claseEstado(reservacion.estado)}`}>
                          {reservacion.estado}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
