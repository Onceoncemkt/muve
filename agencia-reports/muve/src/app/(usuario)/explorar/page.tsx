'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CATEGORIA_LABELS,
  CIUDAD_LABELS,
  DIA_LABELS,
  formatHora,
  proximaFecha,
  type DiaSemana,
  type Ciudad,
  type Negocio,
  type PlanMembresia,
  type ServicioNegocio,
} from '@/types'
import {
  PLAN_LABELS,
  normalizarCategoriaNegocio,
  normalizarPlan,
  puedeReservarConPlan,
} from '@/lib/planes'

type EstadoPlanUsuario = {
  plan_activo: boolean
  plan: PlanMembresia | null
  creditos_extra: number
  creditos_disponibles: number
  limite_creditos_ciclo: number
  max_creditos_por_lugar: number
  creditos_usados_ciclo: number
  creditos_restantes_ciclo: number
}
type FiltroCategoria = 'todas' | 'gimnasio' | 'clases' | 'wellness' | 'restaurantes'
type HorarioExplorar = {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  nombre_coach: string | null
  tipo_clase: string | null
  spots_disponibles?: number
}
type MensajeCard = { tipo: 'ok' | 'error'; texto: string }

const ORDEN_DIAS: Record<DiaSemana, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
}

const FILTROS_CATEGORIA: Array<{ value: FiltroCategoria; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'gimnasio', label: 'Gimnasio' },
  { value: 'clases', label: 'Clases' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'restaurantes', label: 'Restaurantes' },
]
const MAX_INTENTOS_CARGA_NEGOCIOS = 3
const RETRASO_BASE_REINTENTO_MS = 700

async function obtenerEstadoPlanUsuario(): Promise<EstadoPlanUsuario> {
  try {
    const res = await fetch('/api/usuario/plan', { cache: 'no-store' })
    if (!res.ok) {
      return {
        plan_activo: false,
        plan: null,
        creditos_extra: 0,
        creditos_disponibles: 0,
        limite_creditos_ciclo: 0,
        max_creditos_por_lugar: 0,
        creditos_usados_ciclo: 0,
        creditos_restantes_ciclo: 0,
      }
    }

    const data = await res.json()
    return {
      plan_activo: Boolean(data.plan_activo),
      plan: normalizarPlan(data.plan),
      creditos_extra: Number.isFinite(data.creditos_extra) ? Number(data.creditos_extra) : 0,
      creditos_disponibles: Number.isFinite(data.creditos_disponibles ?? data.visitas_disponibles)
        ? Number(data.creditos_disponibles ?? data.visitas_disponibles)
        : 0,
      limite_creditos_ciclo: Number.isFinite(data.limite_creditos_ciclo ?? data.limite_visitas_mensuales)
        ? Number(data.limite_creditos_ciclo ?? data.limite_visitas_mensuales)
        : 0,
      max_creditos_por_lugar: Number.isFinite(data.max_creditos_por_lugar ?? data.max_visitas_por_lugar)
        ? Number(data.max_creditos_por_lugar ?? data.max_visitas_por_lugar)
        : 0,
      creditos_usados_ciclo: Number.isFinite(data.creditos_usados_ciclo ?? data.visitas_usadas_mes)
        ? Number(data.creditos_usados_ciclo ?? data.visitas_usadas_mes)
        : 0,
      creditos_restantes_ciclo: Number.isFinite(data.creditos_restantes_ciclo ?? data.visitas_restantes_mes)
        ? Number(data.creditos_restantes_ciclo ?? data.visitas_restantes_mes)
        : 0,
    }
  } catch {
    return {
      plan_activo: false,
      plan: null,
      creditos_extra: 0,
      creditos_disponibles: 0,
      limite_creditos_ciclo: 0,
      max_creditos_por_lugar: 0,
      creditos_usados_ciclo: 0,
      creditos_restantes_ciclo: 0,
    }
  }
}

function planRequeridoNegocio(negocio: Negocio): PlanMembresia {
  if (negocio.nivel === 'plus' || negocio.nivel === 'total') return negocio.nivel
  return 'basico'
}

function formatearFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
function normalizarHandleSocial(handle: string | null | undefined): string | null {
  if (!handle) return null
  const limpio = handle.trim().replace(/^@+/, '')
  return limpio.length > 0 ? limpio : null
}

function inicialesNegocio(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(fragmento => fragmento[0]?.toUpperCase() ?? '')
    .join('')
}

function formatMoneyMxn(monto: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(monto)
}

function enlaceMapaNegocio(negocio: Negocio) {
  const query = encodeURIComponent(`${negocio.nombre} ${negocio.direccion}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function serviciosWellnessVisibles(negocio: Negocio): ServicioNegocio[] {
  return Array.isArray(negocio.servicios_disponibles)
    ? negocio.servicios_disponibles.filter((servicio) => servicio?.activo !== false)
    : []
}

function serviciosWellnessReservables(negocio: Negocio): ServicioNegocio[] {
  return serviciosWellnessVisibles(negocio)
    .filter((servicio) => typeof servicio.id === 'string' && !servicio.id.startsWith('texto-'))
}

export default function ExplorarPage() {
  const router = useRouter()
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargando, setCargando] = useState(true)
  const [planActivo, setPlanActivo] = useState(false)
  const [planUsuario, setPlanUsuario] = useState<PlanMembresia | null>(null)
  const [visitasDisponiblesMes, setVisitasDisponiblesMes] = useState(0)
  const [maxVisitasPorLugar, setMaxVisitasPorLugar] = useState(0)
  const [visitasRestantesMes, setVisitasRestantesMes] = useState(0)
  const [filtroCiudad, setFiltroCiudad] = useState<Ciudad | 'todas'>('todas')
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todas')
  const [menuReservasAbiertoPorNegocioId, setMenuReservasAbiertoPorNegocioId] =
    useState<Record<string, boolean>>({})
  const [horariosPorNegocioId, setHorariosPorNegocioId] =
    useState<Record<string, HorarioExplorar[]>>({})
  const [cargandoHorariosPorNegocioId, setCargandoHorariosPorNegocioId] =
    useState<Record<string, boolean>>({})
  const [errorHorariosPorNegocioId, setErrorHorariosPorNegocioId] =
    useState<Record<string, string | null>>({})
  const [mensajeReservaPorNegocioId, setMensajeReservaPorNegocioId] =
    useState<Record<string, MensajeCard | null>>({})
  const [servicioSeleccionadoPorNegocioId, setServicioSeleccionadoPorNegocioId] =
    useState<Record<string, string>>({})
  const [reservandoHorarioId, setReservandoHorarioId] = useState<string | null>(null)
  const [errorCargaNegocios, setErrorCargaNegocios] = useState<string | null>(null)
  const [reintentandoNegocios, setReintentandoNegocios] = useState(false)
  const [intentoActualCargaNegocios, setIntentoActualCargaNegocios] = useState(1)
  const [tokenRecargaNegocios, setTokenRecargaNegocios] = useState(0)

  useEffect(() => {
    let activo = true

    async function cargarNegociosYPlan() {
      setCargando(true)
      setErrorCargaNegocios(null)
      setReintentandoNegocios(false)
      setIntentoActualCargaNegocios(1)

      const estadoPlan = await obtenerEstadoPlanUsuario()
      let negociosCargados: Negocio[] = []
      let ultimoErrorNegocios: string | null = null

      for (let intento = 1; intento <= MAX_INTENTOS_CARGA_NEGOCIOS; intento += 1) {
        setIntentoActualCargaNegocios(intento)
        setReintentandoNegocios(intento > 1)

        const respuestaNegocios = await fetch('/api/explorar/negocios', { cache: 'no-store' })
        const payloadNegocios = await respuestaNegocios
          .json()
          .catch(() => ({ negocios: [], error: 'Respuesta inválida' }))

        console.log('[explorar] resultado query negocios activos', {
          intento,
          data: payloadNegocios.negocios ?? [],
          error: payloadNegocios.error ?? null,
          ok: respuestaNegocios.ok,
          status: respuestaNegocios.status,
        })

        if (respuestaNegocios.ok) {
          negociosCargados = (payloadNegocios.negocios ?? []) as Negocio[]
          ultimoErrorNegocios = null
          break
        }

        ultimoErrorNegocios = payloadNegocios.error
          ?? `Error ${respuestaNegocios.status} al cargar negocios`

        if (intento < MAX_INTENTOS_CARGA_NEGOCIOS) {
          const retraso = RETRASO_BASE_REINTENTO_MS * intento
          await new Promise((resolve) => setTimeout(resolve, retraso))
        }
      }

      if (!activo) return

      setPlanActivo(estadoPlan.plan_activo)
      setPlanUsuario(estadoPlan.plan)
      setVisitasDisponiblesMes(estadoPlan.creditos_disponibles || estadoPlan.limite_creditos_ciclo)
      setMaxVisitasPorLugar(estadoPlan.max_creditos_por_lugar)
      setVisitasRestantesMes(estadoPlan.creditos_restantes_ciclo)
      setNegocios(negociosCargados)
      setErrorCargaNegocios(ultimoErrorNegocios)
      setReintentandoNegocios(false)

      setCargando(false)
    }

    void cargarNegociosYPlan()

    return () => {
      activo = false
    }
  }, [tokenRecargaNegocios])

  const cargarHorarios = useCallback(async (negocioId: string) => {
    setCargandoHorariosPorNegocioId((prev) => ({ ...prev, [negocioId]: true }))
    setErrorHorariosPorNegocioId((prev) => ({ ...prev, [negocioId]: null }))

    try {
      const res = await fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioId)}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setHorariosPorNegocioId((prev) => ({ ...prev, [negocioId]: [] }))
        setErrorHorariosPorNegocioId((prev) => ({
          ...prev,
          [negocioId]: data.error ?? 'No se pudieron cargar horarios',
        }))
        return
      }

      const horariosOrdenados = ((data.horarios ?? []) as HorarioExplorar[])
        .slice()
        .sort((a, b) => {
          const diferenciaDia = ORDEN_DIAS[a.dia_semana] - ORDEN_DIAS[b.dia_semana]
          if (diferenciaDia !== 0) return diferenciaDia
          return a.hora_inicio.localeCompare(b.hora_inicio)
        })

      setHorariosPorNegocioId((prev) => ({ ...prev, [negocioId]: horariosOrdenados }))
    } catch {
      setHorariosPorNegocioId((prev) => ({ ...prev, [negocioId]: [] }))
      setErrorHorariosPorNegocioId((prev) => ({
        ...prev,
        [negocioId]: 'Error de conexión al cargar horarios',
      }))
    } finally {
      setCargandoHorariosPorNegocioId((prev) => ({ ...prev, [negocioId]: false }))
    }
  }, [])

  const abrirOCerrarMenuReservas = useCallback((negocio: Negocio, estaAbierto: boolean) => {
    const negocioId = negocio.id
    const categoriaNegocio = normalizarCategoriaNegocio(negocio.categoria)
    if (estaAbierto) {
      setMenuReservasAbiertoPorNegocioId((prev) => ({ ...prev, [negocioId]: false }))
      return
    }
    if (categoriaNegocio === 'estetica') {
      const reservables = serviciosWellnessReservables(negocio)
      setServicioSeleccionadoPorNegocioId((prev) => {
        const actual = prev[negocioId] ?? ''
        if (actual && reservables.some((servicio) => servicio.id === actual)) return prev
        return { ...prev, [negocioId]: reservables[0]?.id ?? '' }
      })
    }

    setMenuReservasAbiertoPorNegocioId((prev) => ({ ...prev, [negocioId]: true }))
    setMensajeReservaPorNegocioId((prev) => ({ ...prev, [negocioId]: null }))
    void cargarHorarios(negocioId)
  }, [cargarHorarios])
  const reservarHorario = useCallback(async (negocio: Negocio, horario: HorarioExplorar) => {
    const negocioId = negocio.id
    const categoriaNegocio = normalizarCategoriaNegocio(negocio.categoria)
    const fecha = formatearFechaISO(proximaFecha(horario.dia_semana))
    const payload: { horario_id: string; fecha: string; servicio_id?: string } = {
      horario_id: horario.id,
      fecha,
    }
    if (categoriaNegocio === 'estetica') {
      const servicioIdSeleccionado = servicioSeleccionadoPorNegocioId[negocioId] ?? ''
      if (!servicioIdSeleccionado) {
        setMensajeReservaPorNegocioId((prev) => ({
          ...prev,
          [negocioId]: { tipo: 'error', texto: 'Selecciona un servicio wellness antes de reservar' },
        }))
        return
      }
      payload.servicio_id = servicioIdSeleccionado
    }
    setReservandoHorarioId(horario.id)
    setMensajeReservaPorNegocioId((prev) => ({ ...prev, [negocioId]: null }))

    try {
      const res = await fetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensajeReservaPorNegocioId((prev) => ({
          ...prev,
          [negocioId]: { tipo: 'error', texto: data.error ?? 'No se pudo crear la reservación' },
        }))
        return
      }

      setMensajeReservaPorNegocioId((prev) => ({
        ...prev,
        [negocioId]: {
          tipo: 'ok',
          texto: `Reservación confirmada para ${DIA_LABELS[horario.dia_semana]} ${formatHora(horario.hora_inicio)}`,
        },
      }))
      void cargarHorarios(negocioId)
    } catch {
      setMensajeReservaPorNegocioId((prev) => ({
        ...prev,
        [negocioId]: { tipo: 'error', texto: 'Error de conexión al crear la reservación' },
      }))
    } finally {
      setReservandoHorarioId(null)
    }
  }, [cargarHorarios, servicioSeleccionadoPorNegocioId])

  const planEfectivo = planActivo ? (planUsuario ?? 'basico') : null
  const ciudadesDisponibles = useMemo(() => {
    const ciudadesUnicas = Array.from(new Set(negocios.map((negocio) => negocio.ciudad)))
    return ciudadesUnicas.sort((a, b) =>
      CIUDAD_LABELS[a].localeCompare(CIUDAD_LABELS[b], 'es')
    )
  }, [negocios])

  const negociosFiltrados = useMemo(() => {
    let resultado = negocios

    if (filtroCiudad !== 'todas') {
      resultado = resultado.filter((negocio) => negocio.ciudad === filtroCiudad)
    }

    if (filtroCategoria === 'wellness') {
      resultado = resultado.filter((negocio) => normalizarCategoriaNegocio(negocio.categoria) === 'estetica')
    } else if (filtroCategoria === 'restaurantes') {
      resultado = resultado.filter((negocio) => normalizarCategoriaNegocio(negocio.categoria) === 'restaurante')
    } else if (filtroCategoria !== 'todas') {
      resultado = resultado.filter((negocio) => normalizarCategoriaNegocio(negocio.categoria) === filtroCategoria)
    }

    return resultado
  }, [negocios, filtroCiudad, filtroCategoria])
  const regresarOInicio = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <button
          type="button"
          onClick={regresarOInicio}
          className="mb-3 inline-flex items-center rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
        >
          ← Inicio
        </button>
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Explorar</h1>
        <p className="mt-1 text-sm text-[#888]">
          {negociosFiltrados.length} {negociosFiltrados.length === 1 ? 'lugar' : 'lugares'} disponibles
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B4FE8]">
          {planEfectivo ? `Plan ${PLAN_LABELS[planEfectivo]}` : 'Sin membresía activa'}
        </p>
        {planEfectivo && (
          <div className="mt-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <p className="text-sm font-bold text-[#0A0A0A]">
              Créditos disponibles este ciclo: {visitasRestantesMes} de {visitasDisponiblesMes}
            </p>
            <p className="mt-1 text-xs text-[#666]">
              Máximo {maxVisitasPorLugar} créditos por lugar con tu plan.
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#777]">
            Filtrar por
          </p>

          <div className="mt-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#555]">
              Ciudad
            </label>
            <select
              value={filtroCiudad}
              onChange={(event) => setFiltroCiudad(event.target.value as Ciudad | 'todas')}
              className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
            >
              <option value="todas">Todas las ciudades</option>
              {ciudadesDisponibles.map((ciudad) => (
                <option key={ciudad} value={ciudad}>
                  {CIUDAD_LABELS[ciudad]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#555]">
              Categoría
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTROS_CATEGORIA.map((categoria) => {
                const activa = filtroCategoria === categoria.value

                return (
                  <button
                    key={categoria.value}
                    type="button"
                    onClick={() => setFiltroCategoria(categoria.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      activa
                        ? 'bg-[#6B4FE8] text-white'
                        : 'border border-[#E5E5E5] bg-white text-[#555] hover:border-[#6B4FE8] hover:text-[#6B4FE8]'
                    }`}
                  >
                    {categoria.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {cargando ? (
          <p className="mt-8 text-center text-sm text-[#888]">
            {reintentandoNegocios
              ? `Reintentando conexión... intento ${intentoActualCargaNegocios} de ${MAX_INTENTOS_CARGA_NEGOCIOS}`
              : 'Cargando negocios...'}
          </p>
        ) : negociosFiltrados.length === 0 ? (
          <div className="mt-16 text-center">
            {errorCargaNegocios ? (
              <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-left">
                <p className="text-sm font-black text-red-800">
                  Error al cargar negocios
                </p>
                <p className="mt-1 text-xs text-red-700">
                  {errorCargaNegocios}
                </p>
                <button
                  type="button"
                  onClick={() => setTokenRecargaNegocios((prev) => prev + 1)}
                  className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
                >
                  Reintentar ahora
                </button>
              </div>
            ) : (
              <p className="font-bold text-[#0A0A0A]">No hay negocios disponibles aún</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negociosFiltrados.map((negocio) => {
              const categoriaNegocio = normalizarCategoriaNegocio(negocio.categoria)
              const planRequerido = planRequeridoNegocio(negocio)
              const puedeReservar = planEfectivo
                ? puedeReservarConPlan(planEfectivo, planRequerido)
                : false
              const instagramHandle = normalizarHandleSocial(negocio.instagram_handle)
              const tiktokHandle = normalizarHandleSocial(negocio.tiktok_handle)
              const esWellness = categoriaNegocio === 'estetica'
              const esRestaurante = categoriaNegocio === 'restaurante'
              const iniciales = inicialesNegocio(negocio.nombre)
              const menuReservasAbierto = Boolean(menuReservasAbiertoPorNegocioId[negocio.id])
              const cargandoHorarios = Boolean(cargandoHorariosPorNegocioId[negocio.id])
              const horarios = horariosPorNegocioId[negocio.id] ?? []
              const errorHorarios = errorHorariosPorNegocioId[negocio.id]
              const mensajeReserva = mensajeReservaPorNegocioId[negocio.id]
              const serviciosWellness = esWellness
                ? serviciosWellnessVisibles(negocio)
                : []
              const serviciosWellnessDisponiblesReservables = esWellness
                ? serviciosWellnessReservables(negocio)
                : []
              const servicioSeleccionadoId = servicioSeleccionadoPorNegocioId[negocio.id] ?? ''
              const badgeNivel = planRequerido === 'plus'
                ? {
                  texto: puedeReservar ? 'Beneficio Plus' : 'Requiere Plus',
                  clase: puedeReservar ? 'bg-[#6B4FE8]/10 text-[#6B4FE8]' : 'bg-[#E5E5E5] text-[#666]',
                }
                : planRequerido === 'total'
                  ? {
                    texto: puedeReservar ? 'Beneficio Total' : 'Requiere Total',
                    clase: puedeReservar ? 'bg-[#6B4FE8]/10 text-[#6B4FE8]' : 'bg-[#E5E5E5] text-[#666]',
                  }
                  : null
              const urlVerMasRestaurante = instagramHandle
                ? `https://instagram.com/${instagramHandle}`
                : enlaceMapaNegocio(negocio)

              return (
                <div key={negocio.id} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                  <div className="relative mb-3 overflow-hidden rounded-lg border border-[#E5E5E5]">
                    {negocio.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={negocio.imagen_url}
                        alt={negocio.nombre}
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-[#6B4FE8] text-4xl font-black tracking-tight text-[#E8FF47]">
                        {iniciales}
                      </div>
                    )}
                    {badgeNivel && (
                      <span className={`absolute right-2 top-2 shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${badgeNivel.clase}`}>
                        {badgeNivel.texto}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-black text-[#0A0A0A]">{negocio.nombre}</h2>
                  </div>
                  {esRestaurante ? (
                    <div className="mt-2 space-y-1 text-sm text-[#555]">
                      {negocio.descripcion && (
                        <p className="text-sm text-[#555]">{negocio.descripcion}</p>
                      )}
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">Dirección:</span> {negocio.direccion}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">Instagram:</span>{' '}
                        {instagramHandle ? (
                          <a
                            href={`https://instagram.com/${instagramHandle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#6B4FE8] underline-offset-2 hover:underline"
                          >
                            @{instagramHandle}
                          </a>
                        ) : (
                          'No disponible'
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm text-[#555]">
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">Categoría:</span> {categoriaNegocio ? CATEGORIA_LABELS[categoriaNegocio] : 'Sin categoría'}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">Ciudad:</span> {CIUDAD_LABELS[negocio.ciudad]}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">Dirección:</span> {negocio.direccion}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">Instagram:</span>{' '}
                        {instagramHandle ? (
                          <a
                            href={`https://instagram.com/${instagramHandle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#6B4FE8] underline-offset-2 hover:underline"
                          >
                            @{instagramHandle}
                          </a>
                        ) : (
                          'No disponible'
                        )}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0A0A0A]">TikTok:</span>{' '}
                        {tiktokHandle ? (
                          <a
                            href={`https://tiktok.com/@${tiktokHandle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#6B4FE8] underline-offset-2 hover:underline"
                          >
                            @{tiktokHandle}
                          </a>
                        ) : (
                          'No disponible'
                        )}
                      </p>
                    </div>
                  )}

                  {esWellness && (
                    <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#555]">
                          Servicios incluidos
                        </p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${puedeReservar ? 'bg-[#6B4FE8]/10 text-[#6B4FE8]' : 'bg-[#E5E5E5] text-[#666]'}`}>
                          {puedeReservar
                            ? (planRequerido === 'total' ? 'Beneficio Total' : planRequerido === 'plus' ? 'Beneficio Plus' : 'Disponible en Básico')
                            : (planRequerido === 'total' ? 'Requiere Total' : planRequerido === 'plus' ? 'Requiere Plus' : 'Disponible en Básico')}
                        </span>
                      </div>
                      {serviciosWellness.length === 0 ? (
                        <p className="mt-1 text-xs text-[#777]">Este negocio aún no publica servicios disponibles.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {serviciosWellness.map((servicio) => (
                            <li key={servicio.id} className="flex items-start justify-between gap-2 text-xs text-[#444]">
                              <span>{servicio.nombre}</span>
                              <span className="shrink-0 text-[#666]">
                                {typeof servicio.precio_normal_mxn === 'number' && servicio.precio_normal_mxn > 0
                                  ? <span className="line-through">{formatMoneyMxn(servicio.precio_normal_mxn)}</span>
                                  : 'Incluido'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {esRestaurante ? (
                    puedeReservar ? (
                      <a
                        href={urlVerMasRestaurante}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-[#0A0A0A] px-3 py-2 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-[#E8FF47]"
                      >
                        Ver más
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="mt-4 w-full cursor-not-allowed rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm font-bold text-[#888]"
                      >
                        {planRequerido === 'plus' ? 'Requiere Plus' : 'Requiere Total'}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirOCerrarMenuReservas(negocio, menuReservasAbierto)}
                      disabled={!puedeReservar}
                      className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                        puedeReservar
                          ? 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
                          : 'cursor-not-allowed border border-[#E5E5E5] bg-[#F7F7F7] text-[#888]'
                      }`}
                    >
                      {!puedeReservar
                        ? planRequerido === 'plus'
                          ? 'Requiere Plus'
                          : 'Requiere Total'
                        : menuReservasAbierto
                          ? esWellness
                            ? 'Ocultar disponibilidad'
                            : 'Ocultar horarios'
                          : esWellness
                            ? 'Reservar servicio'
                            : 'Reservar clase'}
                    </button>
                  )}
                  {!puedeReservar && (
                    <div className="mt-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#666]">
                        {planRequerido === 'plus' ? 'Desbloquea Beneficio Plus' : 'Desbloquea Beneficio Total'}
                      </p>
                      <a
                        href="/planes"
                        className="mt-1 inline-flex rounded-full bg-[#6B4FE8] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#5b40cd]"
                      >
                        Mejorar plan
                      </a>
                    </div>
                  )}

                  {!esRestaurante && puedeReservar && menuReservasAbierto && (
                    <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#555]">
                        {esWellness
                          ? 'Disponibilidad de agenda'
                          : 'Horarios disponibles'}
                      </p>
                      {esWellness && (
                        <div className="mt-2 rounded-md border border-[#E5E5E5] bg-white p-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
                            Servicio a reservar
                          </p>
                          {serviciosWellnessDisponiblesReservables.length === 0 ? (
                            <p className="mt-1 text-xs text-red-700">
                              Este negocio aún no configuró servicios wellness reservables.
                            </p>
                          ) : (
                            <select
                              value={servicioSeleccionadoId}
                              onChange={(event) => {
                                const value = event.target.value
                                setServicioSeleccionadoPorNegocioId((prev) => ({ ...prev, [negocio.id]: value }))
                                setMensajeReservaPorNegocioId((prev) => ({ ...prev, [negocio.id]: null }))
                              }}
                              className="mt-2 w-full rounded-md border border-[#E5E5E5] bg-white px-2 py-2 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                            >
                              <option value="">Selecciona un servicio...</option>
                              {serviciosWellnessDisponiblesReservables.map((servicio) => (
                                <option key={servicio.id} value={servicio.id}>
                                  {servicio.nombre}
                                  {typeof servicio.precio_normal_mxn === 'number' && servicio.precio_normal_mxn > 0
                                    ? ` — ${formatMoneyMxn(servicio.precio_normal_mxn)}`
                                    : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {mensajeReserva && (
                        <div className={`mt-2 rounded-md px-3 py-2 text-xs font-semibold ${
                          mensajeReserva.tipo === 'ok'
                            ? 'bg-[#E8FF47]/40 text-[#0A0A0A]'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {mensajeReserva.texto}
                        </div>
                      )}

                      {cargandoHorarios ? (
                        <p className="mt-2 text-xs text-[#666]">Cargando horarios...</p>
                      ) : errorHorarios ? (
                        <p className="mt-2 text-xs font-semibold text-red-800">{errorHorarios}</p>
                      ) : horarios.length === 0 ? (
                        <p className="mt-2 text-xs text-[#666]">
                          {esWellness
                            ? 'No hay disponibilidad de agenda'
                            : 'No hay horarios disponibles'}
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {horarios.map((horario) => {
                            const reservando = reservandoHorarioId === horario.id
                            const proxima = proximaFecha(horario.dia_semana)
                            const fechaProxima = proxima.toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                            })
                            const spotsDisponibles = typeof horario.spots_disponibles === 'number'
                              ? Math.max(horario.spots_disponibles, 0)
                              : null
                            const requiereServicioWellness = esWellness
                            const puedeReservarHorario = !requiereServicioWellness || Boolean(servicioSeleccionadoId)

                            return (
                              <button
                                key={horario.id}
                                type="button"
                                onClick={() => void reservarHorario(negocio, horario)}
                                disabled={reservando || !puedeReservarHorario}
                                className="flex w-full items-center justify-between rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-left transition-colors hover:border-[#6B4FE8] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="flex flex-col">
                                  <span className="text-sm font-semibold text-[#0A0A0A]">
                                    {DIA_LABELS[horario.dia_semana]} · {formatHora(horario.hora_inicio)} - {formatHora(horario.hora_fin)}
                                  </span>
                                  <span className="text-xs text-[#666]">
                                    Próxima fecha: {fechaProxima}
                                  </span>
                                  {!esWellness && horario.nombre_coach && (
                                    <span className="text-xs text-[#666]">
                                      Coach: {horario.nombre_coach}
                                    </span>
                                  )}
                                  {!esWellness && horario.tipo_clase && (
                                    <span className="text-xs text-[#666]">
                                      Tipo de clase: {horario.tipo_clase}
                                    </span>
                                  )}
                                  <span className="text-xs text-[#666]">
                                    Spots disponibles: {spotsDisponibles !== null ? spotsDisponibles : 'N/D'}
                                  </span>
                                </span>
                                <span className="ml-3 shrink-0 text-xs font-bold text-[#6B4FE8]">
                                  {reservando
                                    ? 'Reservando...'
                                    : !puedeReservarHorario
                                      ? 'Selecciona servicio'
                                      : 'Reservar'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
