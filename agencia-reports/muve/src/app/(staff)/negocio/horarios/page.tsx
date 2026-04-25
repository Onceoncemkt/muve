'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import type { DiaSemana, Rol } from '@/types'
import { DIA_LABELS, formatHora } from '@/types'

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

interface NegocioOption {
  id: string
  nombre: string
  ciudad: string | null
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

export default function NegocioHorariosPage() {
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
      setNegocioId(prev => prev || lista[0]?.id || '')
    }

    void cargarInicial()
    return () => {
      activo = false
    }
  }, [])

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
            <h1 className="text-2xl font-black tracking-tight text-white">Horarios del negocio</h1>
            <p className="mt-1 text-sm text-white/40">Crea, activa y ajusta cupos de reservación</p>
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
            <select value={negocioId} onChange={e => setNegocioId(e.target.value)} className={inputCls}>
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

        {negocioId && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Nuevo horario</h2>
              <button
                onClick={() => setMostrarForm(v => !v)}
                className="rounded-lg bg-[#6B4FE8] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#5a3fd6]"
              >
                {mostrarForm ? 'Cancelar' : '+ Crear horario'}
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
                          {DIA_LABELS[dia]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Capacidad</label>
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
                <button
                  onClick={crearHorario}
                  disabled={guardando}
                  className="w-full rounded-lg bg-[#0A0A0A] py-2.5 text-sm font-bold text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                >
                  {guardando ? 'Guardando...' : 'Crear horario'}
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
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#888]">Tabla de horarios</h2>

            {cargando ? (
              <p className="text-sm text-[#888]">Cargando horarios...</p>
            ) : horarios.length === 0 ? (
              <p className="text-sm text-[#888]">Aún no hay horarios registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] text-[11px] uppercase tracking-widest text-[#888]">
                      <th className="px-2 py-2 font-black">Día</th>
                      <th className="px-2 py-2 font-black">Inicio</th>
                      <th className="px-2 py-2 font-black">Fin</th>
                      <th className="px-2 py-2 font-black">Coach</th>
                      <th className="px-2 py-2 font-black">Tipo clase</th>
                      <th className="px-2 py-2 font-black">Capacidad</th>
                      <th className="px-2 py-2 font-black">Spots hoy</th>
                      <th className="px-2 py-2 font-black">Estado</th>
                      <th className="px-2 py-2 font-black">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horarios.map(horario => (
                      <tr key={horario.id} className="border-b border-[#F0F0F0] align-middle last:border-b-0">
                        <td className="px-2 py-2 font-semibold text-[#0A0A0A]">{DIA_LABELS[horario.dia_semana]}</td>
                        <td className="px-2 py-2 text-[#444]">{formatHora(horario.hora_inicio)}</td>
                        <td className="px-2 py-2 text-[#444]">{formatHora(horario.hora_fin)}</td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={coachDraft[horario.id] ?? horario.nombre_coach ?? ''}
                            onChange={e => setCoachDraft(prev => ({ ...prev, [horario.id]: e.target.value }))}
                            placeholder="Nombre coach"
                            className="w-40 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                          />
                        </td>
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
