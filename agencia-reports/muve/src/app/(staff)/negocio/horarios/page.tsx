'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import type { Categoria, DiaSemana, Rol, ServicioNegocio } from '@/types'
import { CATEGORIA_LABELS, DIA_LABELS, formatHora, proximaFecha } from '@/types'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS_CLASE_OPCIONES = [
  'Cycling',
  'Pilates Reformer',
  'Yoga',
  'HIIT',
  'Funcional',
  'Barre',
  'Pilates Mat',
  'Box Funcional',
]

const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatFechaCorta(fecha: Date): string {
  const partes = DATE_FORMATTER.formatToParts(fecha)
  const dia = partes.find((parte) => parte.type === 'day')?.value ?? ''
  const mes = (partes.find((parte) => parte.type === 'month')?.value ?? '').replace('.', '')
  const year = partes.find((parte) => parte.type === 'year')?.value ?? ''
  return `${dia} ${mes} ${year}`
}

function formatDiaConFecha(dia: DiaSemana): string {
  return `${DIA_LABELS[dia]}, ${formatFechaCorta(proximaFecha(dia))}`
}

interface NegocioOption {
  id: string
  nombre: string
  ciudad: string | null
  categoria?: Categoria | null
  monto_maximo_visita?: number | null
}

interface HorarioConSpots {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  nombre_coach: string | null
  tipo_clase: string | null
  capacidad_total: number
  activo: boolean
  spots_disponibles: number
  spots_ocupados: number
}

interface CargaNegociosResponse {
  rol?: Rol
  negocios?: NegocioOption[]
  error?: string
}

interface PerfilActual {
  rol: Rol
}

type ServicioDraft = {
  nombre: string
  precio_normal_mxn: string
  descripcion: string
}

export default function NegocioHorariosPage() {
  const router = useRouter()
  const [rol, setRol] = useState<Rol>('staff')
  const [negocios, setNegocios] = useState<NegocioOption[]>([])
  const [negocioId, setNegocioId] = useState('')

  const [horarios, setHorarios] = useState<HorarioConSpots[]>([])
  const [capacidadDraft, setCapacidadDraft] = useState<Record<string, number>>({})
  const [coachDraft, setCoachDraft] = useState<Record<string, string>>({})
  const [tipoClaseDraft, setTipoClaseDraft] = useState<Record<string, string>>({})

  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [servicios, setServicios] = useState<ServicioNegocio[]>([])
  const [cargandoServicios, setCargandoServicios] = useState(false)
  const [guardandoServicio, setGuardandoServicio] = useState(false)
  const [actualizandoServicioId, setActualizandoServicioId] = useState<string | null>(null)
  const [nuevoServicio, setNuevoServicio] = useState<ServicioDraft>({
    nombre: '',
    precio_normal_mxn: '',
    descripcion: '',
  })
  const [montoMaximoVisitaDraft, setMontoMaximoVisitaDraft] = useState(0)
  const [guardandoMontoMaximo, setGuardandoMontoMaximo] = useState(false)
  const negocioSeleccionado = negocios.find((negocio) => negocio.id === negocioId) ?? null
  const categoriaNegocio = normalizarCategoriaNegocio(negocioSeleccionado?.categoria)
  const esWellness = categoriaNegocio === 'estetica'
  const esRestaurante = categoriaNegocio === 'restaurante'

  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevoHorario, setNuevoHorario] = useState({
    dia_semana: 'lunes' as DiaSemana,
    hora_inicio: '07:00',
    hora_fin: '08:00',
    capacidad_total: 10,
    nombre_coach: '',
    tipo_clase: '',
  })

  useEffect(() => {
    let activo = true

    async function cargarInicial() {
      const perfilActual: PerfilActual = { rol: 'staff' }
      const res = await fetch('/api/negocio/negocios', { cache: 'no-store' })
      const payload = (await res.json().catch(() => ({}))) as CargaNegociosResponse
      if (!activo) return

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: payload.error ?? 'No se pudieron cargar negocios' })
        return
      }

      setRol(payload.rol ?? perfilActual.rol)
      const lista = (payload.negocios ?? []) as NegocioOption[]
      setNegocios(lista)
      const negocioInicial = lista[0] ?? null
      setNegocioId(negocioInicial?.id ?? '')
      setMontoMaximoVisitaDraft(
        typeof negocioInicial?.monto_maximo_visita === 'number'
          ? Math.max(Math.trunc(negocioInicial.monto_maximo_visita), 0)
          : 0
      )
      if (normalizarCategoriaNegocio(negocioInicial?.categoria) === 'estetica' && negocioInicial.id) {
        const resServicios = await fetch(`/api/negocio/servicios?negocio_id=${encodeURIComponent(negocioInicial.id)}`, {
          cache: 'no-store',
        })
        const payloadServicios = await resServicios.json().catch(() => ({}))
        if (!activo) return
        if (resServicios.ok) {
          setServicios((payloadServicios.servicios ?? []) as ServicioNegocio[])
        } else {
          setServicios([])
        }
      } else {
        setServicios([])
      }
    }

    void cargarInicial()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!esRestaurante) return
    const params = new URLSearchParams({
      status: 'ok',
      msg: 'Los restaurantes no requieren horarios',
    })
    router.replace(`/negocio/dashboard?${params.toString()}`)
  }, [esRestaurante, router])

  const cargarHorarios = useCallback(async () => {
    if (!negocioId) {
      setHorarios([])
      setCapacidadDraft({})
      setCoachDraft({})
      setTipoClaseDraft({})
      return
    }

    setCargando(true)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioId)}&incluir_inactivos=true`)
      const data = await res.json()

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar horarios' })
        setHorarios([])
        setCapacidadDraft({})
        setCoachDraft({})
        setTipoClaseDraft({})
      } else {
        const horariosRecibidos = (data.horarios ?? []) as HorarioConSpots[]
        setHorarios(horariosRecibidos)
        setCapacidadDraft(Object.fromEntries(horariosRecibidos.map(h => [h.id, h.capacidad_total])))
        setCoachDraft(Object.fromEntries(horariosRecibidos.map(h => [h.id, h.nombre_coach ?? ''])))
        setTipoClaseDraft(Object.fromEntries(horariosRecibidos.map(h => [h.id, h.tipo_clase ?? ''])))
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al consultar horarios' })
      setHorarios([])
      setCapacidadDraft({})
      setCoachDraft({})
      setTipoClaseDraft({})
    } finally {
      setCargando(false)
    }
  }, [negocioId])

  const cargarServicios = useCallback(async (negocioIdObjetivo: string) => {
    setCargandoServicios(true)
    try {
      const res = await fetch(`/api/negocio/servicios?negocio_id=${encodeURIComponent(negocioIdObjetivo)}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar servicios wellness' })
        setServicios([])
        return
      }

      setServicios((data.servicios ?? []) as ServicioNegocio[])
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar servicios wellness' })
      setServicios([])
    } finally {
      setCargandoServicios(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      void cargarHorarios()
    }, 0)
    return () => clearTimeout(id)
  }, [cargarHorarios])


  async function crearHorario() {
    if (!negocioId) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un negocio' })
      return
    }
    if (nuevoHorario.capacidad_total < 1) {
      setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
      return
    }
    if (nuevoHorario.hora_inicio >= nuevoHorario.hora_fin) {
      setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser mayor a la hora de inicio' })
      return
    }

    setGuardando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/negocio/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio_id: negocioId, ...nuevoHorario }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo crear el horario' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Horario creado correctamente' })
        setMostrarForm(false)
        setNuevoHorario({
          dia_semana: 'lunes',
          hora_inicio: '07:00',
          hora_fin: '08:00',
          capacidad_total: 10,
          nombre_coach: '',
          tipo_clase: '',
        })
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al crear horario' })
    } finally {
      setGuardando(false)
    }
  }

  async function crearServicioWellness() {
    if (!negocioId || !esWellness) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un negocio wellness para agregar servicios' })
      return
    }

    const nombre = nuevoServicio.nombre.trim()
    const precio = Number.parseInt(nuevoServicio.precio_normal_mxn, 10)
    if (!nombre) {
      setMensaje({ tipo: 'error', texto: 'Nombre del servicio requerido' })
      return
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setMensaje({ tipo: 'error', texto: 'Precio normal inválido' })
      return
    }

    setGuardandoServicio(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/negocio/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: negocioId,
          nombre,
          precio_normal_mxn: precio,
          descripcion: nuevoServicio.descripcion.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo crear el servicio wellness' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Servicio wellness creado' })
        setNuevoServicio({ nombre: '', precio_normal_mxn: '', descripcion: '' })
        void cargarServicios(negocioId)
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al crear servicio wellness' })
    } finally {
      setGuardandoServicio(false)
    }
  }

  async function toggleServicioWellness(servicio: ServicioNegocio) {
    setActualizandoServicioId(servicio.id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/servicios/${servicio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !servicio.activo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo actualizar el servicio wellness' })
      } else {
        setMensaje({
          tipo: 'ok',
          texto: servicio.activo ? 'Servicio desactivado' : 'Servicio activado',
        })
        if (negocioId) void cargarServicios(negocioId)
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar servicio wellness' })
    } finally {
      setActualizandoServicioId(null)
    }
  }

  async function guardarMontoMaximoRestaurante() {
    if (!negocioId || !esRestaurante) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un restaurante para guardar el monto máximo' })
      return
    }

    const monto = Math.trunc(montoMaximoVisitaDraft)
    if (!Number.isFinite(monto) || monto < 0) {
      setMensaje({ tipo: 'error', texto: 'El monto máximo debe ser un entero mayor o igual a 0' })
      return
    }

    setGuardandoMontoMaximo(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/negocio/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: negocioId,
          monto_maximo_visita: monto,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar el monto máximo por visita' })
      } else {
        setNegocios((prev) => prev.map((negocio) => (
          negocio.id === negocioId
            ? { ...negocio, monto_maximo_visita: monto }
            : negocio
        )))
        setMensaje({ tipo: 'ok', texto: 'Monto máximo por visita actualizado' })
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar monto máximo' })
    } finally {
      setGuardandoMontoMaximo(false)
    }
  }

  async function toggleActivo(horarioId: string, activo: boolean) {
    setActualizandoId(horarioId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/horarios/${horarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !activo }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo cambiar estado del horario' })
      } else {
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar horario' })
    } finally {
      setActualizandoId(null)
    }
  }

  async function actualizarCapacidad(horarioId: string) {
    const capacidad = Number(capacidadDraft[horarioId] ?? 0)
    if (!Number.isFinite(capacidad) || capacidad < 1) {
      setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
      return
    }

    setActualizandoId(horarioId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/horarios/${horarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacidad_total: capacidad }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo actualizar capacidad' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Capacidad actualizada' })
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar capacidad' })
    } finally {
      setActualizandoId(null)
    }
  }

  async function actualizarDatosClase(horarioId: string) {
    setActualizandoId(horarioId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/horarios/${horarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_coach: coachDraft[horarioId] ?? '',
          tipo_clase: tipoClaseDraft[horarioId] ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo actualizar coach/tipo de clase' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Coach y tipo de clase actualizados' })
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar coach/tipo de clase' })
    } finally {
      setActualizandoId(null)
    }
  }

  async function eliminarHorario(horarioId: string) {
    if (!confirm('¿Eliminar este horario de forma permanente?')) return

    setActualizandoId(horarioId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/horarios/${horarioId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo eliminar el horario' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Horario eliminado' })
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al eliminar horario' })
    } finally {
      setActualizandoId(null)
    }
  }

  const inputCls = 'w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20'

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/negocio/dashboard"
              className="text-xs font-bold uppercase tracking-widest text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {esWellness ? 'Disponibilidad de agenda' : 'Horarios del negocio'}
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {esWellness
                ? 'Configura día, hora y capacidad para atención simultánea'
                : 'Crea, activa y ajusta cupos de reservación'}
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
              href="/negocio/dashboard"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Dashboard
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Negocio</label>
            <select
              value={negocioId}
              onChange={(e) => {
                const siguienteId = e.target.value
                setNegocioId(siguienteId)
                const negocio = negocios.find((item) => item.id === siguienteId)
                setMontoMaximoVisitaDraft(
                  typeof negocio?.monto_maximo_visita === 'number'
                    ? Math.max(Math.trunc(negocio.monto_maximo_visita), 0)
                    : 0
                )
                if (normalizarCategoriaNegocio(negocio?.categoria) === 'estetica' && siguienteId) {
                  void cargarServicios(siguienteId)
                } else {
                  setServicios([])
                }
              }}
              className={inputCls}
            >
              <option value="">Selecciona un negocio...</option>
              {negocios.map(n => (
                <option key={n.id} value={n.id}>
                  {n.ciudad
                    ? `${n.nombre} — ${n.ciudad.charAt(0).toUpperCase() + n.ciudad.slice(1)}`
                    : n.nombre}
                </option>
              ))}
            </select>
          </div>
          {negocioSeleccionado && (
            <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-xs text-[#555]">
              <p>
                <span className="font-bold text-[#0A0A0A]">Categoría:</span>{' '}
                {categoriaNegocio
                  ? CATEGORIA_LABELS[categoriaNegocio]
                  : 'Sin categoría'}
              </p>
              {esRestaurante && (
                <p className="mt-1">
                  <span className="font-bold text-[#0A0A0A]">Monto máximo actual:</span>{' '}
                  ${Math.max(Math.trunc(negocioSeleccionado.monto_maximo_visita ?? 0), 0)} MXN
                </p>
              )}
            </div>
          )}
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

        {negocioId && esWellness && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">
              Servicios wellness incluidos
            </h2>
            <p className="mt-1 text-xs text-[#666]">
              Agrega servicios con su precio normal y controla si están activos para reservar.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Servicio</label>
                <input
                  type="text"
                  value={nuevoServicio.nombre}
                  onChange={(e) => setNuevoServicio((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej. Manicure básica"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Precio normal (MXN)</label>
                <input
                  type="number"
                  min={0}
                  value={nuevoServicio.precio_normal_mxn}
                  onChange={(e) => setNuevoServicio((prev) => ({ ...prev, precio_normal_mxn: e.target.value }))}
                  placeholder="Ej. 250"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Descripción (opcional)</label>
                <input
                  type="text"
                  value={nuevoServicio.descripcion}
                  onChange={(e) => setNuevoServicio((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Ej. Incluye esmalte semipermanente"
                  className={inputCls}
                />
              </div>
            </div>

            <button
              onClick={crearServicioWellness}
              disabled={guardandoServicio}
              className="mt-3 rounded-lg bg-[#6B4FE8] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-40"
            >
              {guardandoServicio ? 'Guardando...' : 'Agregar servicio'}
            </button>

            <div className="mt-3 space-y-2">
              {cargandoServicios ? (
                <p className="text-sm text-[#888]">Cargando servicios...</p>
              ) : servicios.length === 0 ? (
                <p className="text-sm text-[#888]">Aún no hay servicios wellness registrados.</p>
              ) : (
                servicios.map((servicio) => (
                  <div
                    key={servicio.id}
                    className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">{servicio.nombre}</p>
                      <p className="text-xs text-[#666]">Precio normal: ${Math.max(Math.trunc(servicio.precio_normal_mxn ?? 0), 0)} MXN</p>
                      {servicio.descripcion && (
                        <p className="text-xs text-[#666]">{servicio.descripcion}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                          servicio.activo ? 'bg-[#E8FF47]/40 text-[#0A0A0A]' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {servicio.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        onClick={() => void toggleServicioWellness(servicio)}
                        disabled={actualizandoServicioId === servicio.id}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                          servicio.activo
                            ? 'bg-[#E5E5E5] text-[#666] hover:bg-red-100 hover:text-red-700'
                            : 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
                        } disabled:opacity-40`}
                      >
                        {actualizandoServicioId === servicio.id
                          ? 'Guardando...'
                          : servicio.activo
                            ? 'Desactivar'
                            : 'Activar'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {negocioId && esRestaurante && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-green-800">
              Consumo máximo por visita
            </h2>
            <p className="mt-1 text-xs text-green-800/80">
              Define el monto máximo que el usuario puede consumir por check-in en este restaurante.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:max-w-xs">
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-green-900/80">
                  Monto máximo (MXN)
                </label>
                <input
                  type="number"
                  min={0}
                  value={montoMaximoVisitaDraft}
                  onChange={(e) => setMontoMaximoVisitaDraft(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <button
                onClick={guardarMontoMaximoRestaurante}
                disabled={guardandoMontoMaximo}
                className="rounded-lg bg-green-700 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-green-800 disabled:opacity-40"
              >
                {guardandoMontoMaximo ? 'Guardando...' : 'Guardar monto'}
              </button>
            </div>
          </div>
        )}

        {negocioId && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">
                {esWellness ? 'Nueva disponibilidad de agenda' : 'Nuevo horario'}
              </h2>
              <button
                onClick={() => setMostrarForm(v => !v)}
                className="rounded-lg bg-[#6B4FE8] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#5a3fd6]"
              >
                {mostrarForm ? 'Cancelar' : (esWellness ? '+ Crear disponibilidad' : '+ Crear horario')}
              </button>
            </div>

            {mostrarForm && (
              <div className="space-y-2.5 rounded-lg border border-[#6B4FE8]/20 bg-[#6B4FE8]/5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Día</label>
                    <select
                      value={nuevoHorario.dia_semana}
                      onChange={e => setNuevoHorario(h => ({ ...h, dia_semana: e.target.value as DiaSemana }))}
                      className={inputCls}
                    >
                      {DIAS.map(dia => (
                        <option key={dia} value={dia}>
                          {formatDiaConFecha(dia)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">
                      {esWellness ? 'Capacidad (personas simultáneas)' : 'Capacidad'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={nuevoHorario.capacidad_total}
                      onChange={e => setNuevoHorario(h => ({ ...h, capacidad_total: Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora inicio</label>
                    <input
                      type="time"
                      value={nuevoHorario.hora_inicio}
                      onChange={e => setNuevoHorario(h => ({ ...h, hora_inicio: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora fin</label>
                    <input
                      type="time"
                      value={nuevoHorario.hora_fin}
                      onChange={e => setNuevoHorario(h => ({ ...h, hora_fin: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                {!esWellness && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">
                        Nombre del coach/instructor
                      </label>
                      <input
                        type="text"
                        value={nuevoHorario.nombre_coach}
                        onChange={e => setNuevoHorario(h => ({ ...h, nombre_coach: e.target.value }))}
                        placeholder="Ej. Mariana López"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">
                        Tipo de clase
                      </label>
                      <input
                        type="text"
                        list="tipos-clase-opciones"
                        value={nuevoHorario.tipo_clase}
                        onChange={e => setNuevoHorario(h => ({ ...h, tipo_clase: e.target.value }))}
                        placeholder="Ej. Cycling"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
                <button
                  onClick={crearHorario}
                  disabled={guardando}
                  className="w-full rounded-lg bg-[#0A0A0A] py-2.5 text-sm font-bold text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                >
                  {guardando
                    ? 'Guardando...'
                    : (esWellness ? 'Guardar disponibilidad' : 'Crear horario')}
                </button>
              </div>
            )}
          </div>
        )}

        {!negocioId && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center text-sm text-[#888]">
            Selecciona un negocio para gestionar horarios.
          </div>
        )}

        {negocioId && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#888]">
              {esWellness ? 'Disponibilidad de agenda' : 'Tabla de horarios'}
            </h2>

            {cargando ? (
              <p className="text-sm text-[#888]">Cargando horarios...</p>
            ) : horarios.length === 0 ? (
              <p className="text-sm text-[#888]">
                {esWellness
                  ? 'Aún no hay disponibilidad de agenda registrada.'
                  : 'Aún no hay horarios registrados.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] text-[11px] uppercase tracking-widest text-[#888]">
                      <th className="px-2 py-2 font-black">Día</th>
                      <th className="px-2 py-2 font-black">Inicio</th>
                      <th className="px-2 py-2 font-black">Fin</th>
                      {!esWellness && <th className="px-2 py-2 font-black">Coach</th>}
                      {!esWellness && <th className="px-2 py-2 font-black">Tipo clase</th>}
                      <th className="px-2 py-2 font-black">Capacidad</th>
                      <th className="px-2 py-2 font-black">
                        {esWellness ? 'Disponibilidad hoy' : 'Spots hoy'}
                      </th>
                      <th className="px-2 py-2 font-black">Estado</th>
                      <th className="px-2 py-2 font-black">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horarios.map(horario => (
                      <tr key={horario.id} className="border-b border-[#F0F0F0] align-middle last:border-b-0">
                        <td className="px-2 py-2 font-semibold text-[#0A0A0A]">{formatDiaConFecha(horario.dia_semana)}</td>
                        <td className="px-2 py-2 text-[#444]">{formatHora(horario.hora_inicio)}</td>
                        <td className="px-2 py-2 text-[#444]">{formatHora(horario.hora_fin)}</td>
                        {!esWellness && (
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={coachDraft[horario.id] ?? horario.nombre_coach ?? ''}
                              onChange={e => setCoachDraft(prev => ({ ...prev, [horario.id]: e.target.value }))}
                              placeholder="Nombre coach"
                              className="w-40 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                            />
                          </td>
                        )}
                        {!esWellness && (
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                list="tipos-clase-opciones"
                                value={tipoClaseDraft[horario.id] ?? horario.tipo_clase ?? ''}
                                onChange={e => setTipoClaseDraft(prev => ({ ...prev, [horario.id]: e.target.value }))}
                                placeholder="Tipo de clase"
                                className="w-40 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                              />
                              <button
                                onClick={() => actualizarDatosClase(horario.id)}
                                disabled={actualizandoId === horario.id}
                                className="rounded-md bg-[#0A0A0A] px-2 py-1 text-[10px] font-bold uppercase text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                              >
                                Guardar
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={capacidadDraft[horario.id] ?? horario.capacidad_total}
                              onChange={e => setCapacidadDraft(prev => ({ ...prev, [horario.id]: Number(e.target.value) }))}
                              className="w-20 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                            />
                            <button
                              onClick={() => actualizarCapacidad(horario.id)}
                              disabled={actualizandoId === horario.id}
                              className="rounded-md bg-[#6B4FE8] px-2 py-1 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-40"
                            >
                              Guardar
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-[#444]">
                          {Math.max(horario.spots_disponibles, 0)} / {horario.capacidad_total}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                              horario.activo
                                ? 'bg-[#E8FF47]/30 text-[#0A0A0A]'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {horario.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => toggleActivo(horario.id, horario.activo)}
                              disabled={actualizandoId === horario.id}
                              className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                                horario.activo
                                  ? 'bg-[#E5E5E5] text-[#666] hover:bg-red-100 hover:text-red-700'
                                  : 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
                              } disabled:opacity-40`}
                            >
                              {horario.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            {rol === 'admin' && (
                              <button
                                onClick={() => eliminarHorario(horario.id)}
                                disabled={actualizandoId === horario.id}
                                className="rounded-md bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 transition-colors hover:bg-red-200 disabled:opacity-40"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <datalist id="tipos-clase-opciones">
          {TIPOS_CLASE_OPCIONES.map((tipo) => (
            <option key={tipo} value={tipo} />
          ))}
        </datalist>
      </div>
    </div>
  )
}
