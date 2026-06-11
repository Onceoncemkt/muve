'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatHora } from '@/types'

type EstadoReservacion = 'confirmada' | 'completada' | 'no_show' | 'cancelada'

type Reservacion = {
  id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  tipo_clase: string | null
  servicio_nombre: string | null
  estado: EstadoReservacion | string
  monto_negocio_mxn: number
  usuario: {
    id: string
    nombre: string
    plan: string | null
    foto_url: string | null
    tiene_lesion: boolean
    tiene_nota: boolean
  } | null
}

type PerfilUsuario = {
  id: string
  nombre: string
  plan: string | null
  genero: string | null
  foto_url: string | null
  lesiones: string | null
  objetivo_entrenamiento: string | null
  nivel_condicion: string | null
  disciplinas: string[]
  notas_negocio: string | null
  total_visitas_negocio: number
  ultima_visita_negocio: string | null
}

const GENERO_LABEL_STAFF: Record<string, string> = {
  masculino: 'Hombre',
  femenino: 'Mujer',
  prefiero_no_decir: 'Prefiero no decir',
}

type Periodo = 'historial' | 'hoy' | 'semana' | 'mes' | 'rango'
type FiltroEstado = 'todas' | EstadoReservacion

const ESTADO_LABEL: Record<string, string> = {
  confirmada: 'Confirmada',
  completada: 'Completada',
  no_show: 'No asistió',
  cancelada: 'Cancelada',
}

const PAGE_SIZE = 20

function formatMonedaMXN(v: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(v)
}

function formatFechaCorta(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFechaAmigable(fecha: string) {
  const f = new Date(`${fecha}T00:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const mañana = new Date(hoy)
  mañana.setDate(hoy.getDate() + 1)

  const isoF = f.toISOString().slice(0, 10)
  if (isoF === hoy.toISOString().slice(0, 10)) return 'Hoy'
  if (isoF === mañana.toISOString().slice(0, 10)) return 'Mañana'

  const diaSemana = f.toLocaleDateString('es-MX', { weekday: 'long' })
  const diaMes = f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  return `${diaSemana[0].toUpperCase() + diaSemana.slice(1)} ${diaMes}`
}

function inicialesDe(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('') || 'MU'
}

function planLabel(plan: string | null) {
  if (plan === 'plus') return 'Plus'
  if (plan === 'total') return 'Total'
  if (plan === 'basico') return 'Básico'
  return 'Sin plan'
}

function clasesPlanBadge(plan: string | null) {
  if (plan === 'total') return 'bg-[#E8FF47] text-[#0A0A0A]'
  if (plan === 'plus') return 'bg-[#6B4FE8]/15 text-[#6B4FE8] ring-1 ring-[#6B4FE8]/30'
  if (plan === 'basico') return 'bg-[#F3F4F6] text-[#555]'
  return 'bg-[#F3F4F6] text-[#888]'
}

function clasesEstadoBadge(estado: string) {
  if (estado === 'completada') return 'bg-green-100 text-green-800 ring-1 ring-green-300'
  if (estado === 'confirmada') return 'bg-[#6B4FE8]/15 text-[#6B4FE8] ring-1 ring-[#6B4FE8]/30'
  if (estado === 'no_show') return 'bg-red-100 text-red-700 ring-1 ring-red-300'
  if (estado === 'cancelada') return 'bg-[#F3F4F6] text-[#666] ring-1 ring-[#E5E5E5]'
  return 'bg-[#F3F4F6] text-[#666]'
}

export default function NegocioReservacionesPanel() {
  const [tab, setTab] = useState<'proximas' | 'hoy' | 'historial'>('proximas')

  // Próximas
  const [proximas, setProximas] = useState<Reservacion[]>([])
  const [proximasCargando, setProximasCargando] = useState(true)
  const [proximasError, setProximasError] = useState<string | null>(null)

  // Hoy
  const [hoyReservaciones, setHoyReservaciones] = useState<Reservacion[]>([])
  const [hoyCargando, setHoyCargando] = useState(true)
  const [hoyError, setHoyError] = useState<string | null>(null)

  // Historial
  const [periodo, setPeriodo] = useState<Periodo>('historial')
  const [desde, setDesde] = useState<string>('')
  const [hasta, setHasta] = useState<string>('')
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>('todas')
  const [pagina, setPagina] = useState(1)
  const [historial, setHistorial] = useState<Reservacion[]>([])
  const [historialTotal, setHistorialTotal] = useState(0)
  const [historialCargando, setHistorialCargando] = useState(false)
  const [historialError, setHistorialError] = useState<string | null>(null)

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [perfilCargando, setPerfilCargando] = useState(false)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [perfilUsuario, setPerfilUsuario] = useState<PerfilUsuario | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await fetch('/api/negocio/reservaciones?periodo=hoy&page_size=100', { cache: 'no-store' })
        const data = await res.json().catch(() => ({})) as { reservaciones?: Reservacion[]; error?: string }
        if (!activo) return
        if (!res.ok) {
          setHoyError(typeof data.error === 'string' ? data.error : 'No se pudieron cargar las reservaciones de hoy')
          setHoyReservaciones([])
          return
        }
        setHoyReservaciones(data.reservaciones ?? [])
      } catch {
        if (!activo) return
        setHoyError('Error de conexión al cargar reservaciones de hoy')
        setHoyReservaciones([])
      } finally {
        if (activo) setHoyCargando(false)
      }
    }
    void cargar()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await fetch('/api/negocio/reservaciones?periodo=proximas&page_size=10', { cache: 'no-store' })
        const data = await res.json().catch(() => ({})) as { reservaciones?: Reservacion[]; error?: string }
        if (!activo) return
        if (!res.ok) {
          setProximasError(typeof data.error === 'string' ? data.error : 'No se pudieron cargar las próximas reservaciones')
          setProximas([])
          return
        }
        setProximas(data.reservaciones ?? [])
      } catch {
        if (!activo) return
        setProximasError('Error de conexión al cargar próximas reservaciones')
        setProximas([])
      } finally {
        if (activo) setProximasCargando(false)
      }
    }
    void cargar()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (tab !== 'historial') return
    let activo = true
    async function cargar() {
      try {
        if (!activo) return
        setHistorialCargando(true)
        setHistorialError(null)

        const params = new URLSearchParams({
          periodo,
          page: String(pagina),
          page_size: String(PAGE_SIZE),
        })
        if (periodo === 'rango') {
          if (desde) params.set('desde', desde)
          if (hasta) params.set('hasta', hasta)
        }
        if (estadoFiltro !== 'todas') params.set('estado', estadoFiltro)

        const res = await fetch(`/api/negocio/reservaciones?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({})) as {
          reservaciones?: Reservacion[]
          total?: number
          error?: string
        }
        if (!activo) return
        if (!res.ok) {
          setHistorialError(typeof data.error === 'string' ? data.error : 'No se pudo cargar el historial')
          setHistorial([])
          setHistorialTotal(0)
          return
        }
        setHistorial(data.reservaciones ?? [])
        setHistorialTotal(data.total ?? 0)
      } catch {
        if (!activo) return
        setHistorialError('Error de conexión al cargar el historial')
        setHistorial([])
        setHistorialTotal(0)
      } finally {
        if (activo) setHistorialCargando(false)
      }
    }
    void cargar()
    return () => {
      activo = false
    }
  }, [tab, periodo, desde, hasta, estadoFiltro, pagina])

  const totalPaginas = Math.max(1, Math.ceil(historialTotal / PAGE_SIZE))

  async function abrirPerfil(usuarioId: string) {
    setModalAbierto(true)
    setPerfilCargando(true)
    setPerfilError(null)
    setPerfilUsuario(null)
    try {
      const res = await fetch(`/api/negocio/usuarios/${encodeURIComponent(usuarioId)}/perfil`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({})) as { usuario?: PerfilUsuario; error?: string }
      if (!res.ok || !data.usuario) {
        setPerfilError(typeof data.error === 'string' ? data.error : 'No se pudo cargar el perfil del usuario')
        return
      }
      setPerfilUsuario(data.usuario)
    } catch {
      setPerfilError('Error de conexión al cargar el perfil del usuario')
    } finally {
      setPerfilCargando(false)
    }
  }

  function cerrarModal() {
    setModalAbierto(false)
    setPerfilUsuario(null)
    setPerfilError(null)
  }

  const filaReservacion = useCallback((r: Reservacion, columnas: 'proximas' | 'hoy' | 'historial') => {
    const usuario = r.usuario
    const horaTxt = r.hora_inicio ? formatHora(r.hora_inicio) : '—'
    const encabezado = columnas === 'hoy'
      ? horaTxt
      : columnas === 'proximas'
        ? `${formatFechaAmigable(r.fecha)} · ${horaTxt}`
        : `${formatFechaCorta(r.fecha)} · ${horaTxt}`
    return (
      <div
        key={r.id}
        className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[#0A0A0A]">
              {encabezado}
            </span>
            {r.tipo_clase && (
              <span className="text-xs font-semibold text-[#666]">· {r.tipo_clase}</span>
            )}
            {r.servicio_nombre && (
              <span className="text-xs font-semibold text-[#666]">· {r.servicio_nombre}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-[#0A0A0A]">
              {usuario?.nombre ?? 'Usuario eliminado'}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${clasesPlanBadge(usuario?.plan ?? null)}`}>
              {planLabel(usuario?.plan ?? null)}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${clasesEstadoBadge(r.estado)}`}>
              {ESTADO_LABEL[r.estado] ?? r.estado}
            </span>
            {usuario?.tiene_lesion && (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700 ring-1 ring-red-300">
                Lesión
              </span>
            )}
            {usuario?.tiene_nota && (
              <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-800 ring-1 ring-yellow-300">
                Nota
              </span>
            )}
            {columnas === 'historial' && r.monto_negocio_mxn > 0 && (
              <span className="text-[11px] font-semibold text-[#6B4FE8]">
                {formatMonedaMXN(r.monto_negocio_mxn)}
              </span>
            )}
          </div>
        </div>

        {usuario && (
          <button
            type="button"
            onClick={() => void abrirPerfil(usuario.id)}
            className="shrink-0 rounded-md border border-[#6B4FE8] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white"
          >
            Ver perfil
          </button>
        )}
      </div>
    )
  }, [])

  const cuerpoProximas = useMemo(() => {
    if (proximasCargando) return <p className="text-sm text-[#666]">Cargando próximas reservaciones...</p>
    if (proximasError) return <p className="text-sm text-red-700">{proximasError}</p>
    if (proximas.length === 0) {
      return <p className="text-sm text-[#666]">No tienes próximas reservaciones confirmadas.</p>
    }
    return (
      <div className="space-y-2">
        {proximas.map(r => filaReservacion(r, 'proximas'))}
      </div>
    )
  }, [proximasCargando, proximasError, proximas, filaReservacion])

  const cuerpoHoy = useMemo(() => {
    if (hoyCargando) return <p className="text-sm text-[#666]">Cargando reservaciones...</p>
    if (hoyError) return <p className="text-sm text-red-700">{hoyError}</p>
    if (hoyReservaciones.length === 0) {
      return <p className="text-sm text-[#666]">No hay reservaciones para hoy.</p>
    }
    return (
      <div className="space-y-2">
        {hoyReservaciones.map(r => filaReservacion(r, 'hoy'))}
      </div>
    )
  }, [hoyCargando, hoyError, hoyReservaciones, filaReservacion])

  const cuerpoHistorial = useMemo(() => {
    if (historialCargando) return <p className="text-sm text-[#666]">Cargando historial...</p>
    if (historialError) return <p className="text-sm text-red-700">{historialError}</p>
    if (historial.length === 0) {
      return <p className="text-sm text-[#666]">No hay reservaciones para los filtros seleccionados.</p>
    }
    return (
      <div className="space-y-2">
        {historial.map(r => filaReservacion(r, 'historial'))}
      </div>
    )
  }, [historialCargando, historialError, historial, filaReservacion])

  return (
    <section className="rounded-xl border border-[#E5E5E5] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Reservaciones</p>
          <p className="mt-1 text-base font-bold text-[#0A0A0A]">
            {tab === 'proximas'
              ? 'Próximas reservaciones'
              : tab === 'hoy'
                ? 'Reservaciones de hoy'
                : 'Historial completo'}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-[#F3F4F6] p-1 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setTab('proximas')}
            className={`rounded-md px-3 py-1.5 transition-colors ${tab === 'proximas' ? 'bg-[#0A0A0A] text-[#E8FF47]' : 'text-[#555]'}`}
          >
            Próximas
          </button>
          <button
            type="button"
            onClick={() => setTab('hoy')}
            className={`rounded-md px-3 py-1.5 transition-colors ${tab === 'hoy' ? 'bg-[#0A0A0A] text-[#E8FF47]' : 'text-[#555]'}`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setTab('historial')}
            className={`rounded-md px-3 py-1.5 transition-colors ${tab === 'historial' ? 'bg-[#0A0A0A] text-[#E8FF47]' : 'text-[#555]'}`}
          >
            Historial
          </button>
        </div>
      </div>

      {tab === 'historial' && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#666]">Período</span>
            <select
              value={periodo}
              onChange={e => {
                setPeriodo(e.target.value as Periodo)
                setPagina(1)
              }}
              className="mt-1 w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
            >
              <option value="historial">Todo el historial</option>
              <option value="semana">Semana actual</option>
              <option value="mes">Mes actual</option>
              <option value="rango">Rango personalizado</option>
            </select>
          </label>

          <label className="block text-xs">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#666]">Estado</span>
            <select
              value={estadoFiltro}
              onChange={e => {
                setEstadoFiltro(e.target.value as FiltroEstado)
                setPagina(1)
              }}
              className="mt-1 w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
            >
              <option value="todas">Todas</option>
              <option value="confirmada">Confirmadas</option>
              <option value="completada">Completadas</option>
              <option value="no_show">No-show</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </label>

          {periodo === 'rango' && (
            <>
              <label className="block text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-[#666]">Desde</span>
                <input
                  type="date"
                  value={desde}
                  onChange={e => {
                    setDesde(e.target.value)
                    setPagina(1)
                  }}
                  className="mt-1 w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </label>
              <label className="block text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-[#666]">Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  onChange={e => {
                    setHasta(e.target.value)
                    setPagina(1)
                  }}
                  className="mt-1 w-full rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </label>
            </>
          )}
        </div>
      )}

      <div className="mt-4">
        {tab === 'proximas' && cuerpoProximas}
        {tab === 'hoy' && cuerpoHoy}
        {tab === 'historial' && cuerpoHistorial}
      </div>

      {tab === 'historial' && historial.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#666]">
          <span>Página {pagina} de {totalPaginas} · {historialTotal} resultados</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina <= 1 || historialCargando}
              className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#555] hover:border-[#6B4FE8] hover:text-[#6B4FE8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas || historialCargando}
              className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#555] hover:border-[#6B4FE8] hover:text-[#6B4FE8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Perfil del usuario</p>
              <button
                type="button"
                onClick={cerrarModal}
                className="rounded-md border border-[#E5E5E5] px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
              >
                Cerrar
              </button>
            </div>

            {perfilCargando && (
              <p className="mt-4 text-sm text-[#666]">Cargando perfil...</p>
            )}

            {perfilError && !perfilCargando && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {perfilError}
              </p>
            )}

            {perfilUsuario && !perfilCargando && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#6B4FE8] text-base font-black text-white">
                    {perfilUsuario.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={perfilUsuario.foto_url} alt={perfilUsuario.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <span>{inicialesDe(perfilUsuario.nombre)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[#0A0A0A]">{perfilUsuario.nombre}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${clasesPlanBadge(perfilUsuario.plan)}`}>
                        Plan {planLabel(perfilUsuario.plan)}
                      </span>
                      {perfilUsuario.genero && (
                        <span className="inline-flex rounded-md bg-[#EFEAFF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6B4FE8]">
                          {GENERO_LABEL_STAFF[perfilUsuario.genero] ?? perfilUsuario.genero}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Visitas aquí</p>
                    <p className="mt-1 text-xl font-black text-[#0A0A0A]">
                      {perfilUsuario.total_visitas_negocio}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Última visita</p>
                    <p className="mt-1 text-sm font-bold text-[#0A0A0A]">
                      {perfilUsuario.ultima_visita_negocio
                        ? formatFechaCorta(perfilUsuario.ultima_visita_negocio)
                        : 'Sin visitas'}
                    </p>
                  </div>
                </div>

                {perfilUsuario.lesiones && perfilUsuario.lesiones.trim() && (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-800">
                      Condiciones físicas / lesiones
                    </p>
                    <p className="mt-1 text-sm text-yellow-900">{perfilUsuario.lesiones}</p>
                  </div>
                )}

                {(perfilUsuario.objetivo_entrenamiento || perfilUsuario.nivel_condicion || perfilUsuario.disciplinas.length > 0) && (
                  <div className="rounded-lg border border-[#E5E5E5] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Entrenamiento</p>
                    <div className="mt-2 space-y-1 text-sm text-[#0A0A0A]">
                      {perfilUsuario.objetivo_entrenamiento && (
                        <p>
                          <span className="font-bold">Objetivo:</span> {perfilUsuario.objetivo_entrenamiento}
                        </p>
                      )}
                      {perfilUsuario.nivel_condicion && (
                        <p>
                          <span className="font-bold">Nivel:</span> {perfilUsuario.nivel_condicion}
                        </p>
                      )}
                      {perfilUsuario.disciplinas.length > 0 && (
                        <div>
                          <span className="font-bold">Disciplinas favoritas:</span>{' '}
                          <span className="inline-flex flex-wrap gap-1">
                            {perfilUsuario.disciplinas.map(d => (
                              <span key={d} className="rounded-md bg-[#6B4FE8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#6B4FE8]">
                                {d}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {perfilUsuario.notas_negocio && perfilUsuario.notas_negocio.trim() && (
                  <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                      Nota para el negocio
                    </p>
                    <p className="mt-1 text-sm text-[#0A0A0A]">{perfilUsuario.notas_negocio}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
