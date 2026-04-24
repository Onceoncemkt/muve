'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DiaSemana, Rol } from '@/types'
import { DIA_LABELS, formatHora } from '@/types'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

interface NegocioOption {
  id: string
  nombre: string
  ciudad: string
}

interface HorarioConSpots {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  capacidad_total: number
  activo: boolean
  spots_disponibles: number
  spots_ocupados: number
}

type UsuarioReserva = { id: string; nombre: string; email: string }
type HorarioReserva = { id: string; dia_semana: string; hora_inicio: string; hora_fin: string }

interface ReservacionNegocio {
  id: string
  fecha: string
  estado: string
  created_at: string
  users: UsuarioReserva | UsuarioReserva[] | null
  horarios: HorarioReserva | HorarioReserva[] | null
}

function obtenerRelacion<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default function NegocioDashboardPage() {
  const [rol, setRol] = useState<Rol>('staff')
  const [negocios, setNegocios] = useState<NegocioOption[]>([])
  const [negocioId, setNegocioId] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])

  const [horarios, setHorarios] = useState<HorarioConSpots[]>([])
  const [reservaciones, setReservaciones] = useState<ReservacionNegocio[]>([])
  const [capacidadDraft, setCapacidadDraft] = useState<Record<string, number>>({})

  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [completandoId, setCompletandoId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevoHorario, setNuevoHorario] = useState({
    dia_semana: 'lunes' as DiaSemana,
    hora_inicio: '07:00',
    hora_fin: '08:00',
    capacidad_total: 10,
  })

  useEffect(() => {
    let activo = true

    async function cargarInicial() {
      const supabase = createClient()

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: perfil } = await supabase
          .from('users')
          .select('rol')
          .eq('id', userData.user.id)
          .single()
        if (activo && perfil?.rol) setRol(perfil.rol as Rol)
      }

      const { data, error } = await supabase
        .from('negocios')
        .select('id, nombre, ciudad')
        .eq('activo', true)
        .order('ciudad')
        .order('nombre')

      if (!activo) return
      if (error) {
        setMensaje({ tipo: 'error', texto: 'No se pudieron cargar negocios' })
        return
      }

      const lista = (data ?? []) as NegocioOption[]
      setNegocios(lista)
      setNegocioId(prev => prev || lista[0]?.id || '')
    }

    cargarInicial()
    return () => { activo = false }
  }, [])

  const cargarDatos = useCallback(async () => {
    if (!negocioId) {
      setHorarios([])
      setReservaciones([])
      return
    }

    setCargando(true)
    setMensaje(null)

    try {
      const [hRes, rRes] = await Promise.all([
        fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioId)}&incluir_inactivos=true`),
        fetch(`/api/negocio/reservaciones?negocio_id=${encodeURIComponent(negocioId)}&fecha=${encodeURIComponent(fecha)}`),
      ])

      const hData = await hRes.json()
      const rData = await rRes.json()

      if (!hRes.ok) {
        setMensaje({ tipo: 'error', texto: hData.error ?? 'Error al cargar horarios' })
        setHorarios([])
      } else {
        const horariosRecibidos = (hData.horarios ?? []) as HorarioConSpots[]
        setHorarios(horariosRecibidos)
        setCapacidadDraft(Object.fromEntries(horariosRecibidos.map(h => [h.id, h.capacidad_total])))
      }

      if (!rRes.ok) {
        setMensaje({ tipo: 'error', texto: rData.error ?? 'Error al cargar reservaciones' })
        setReservaciones([])
      } else {
        setReservaciones((rData.reservaciones ?? []) as ReservacionNegocio[])
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar datos' })
    } finally {
      setCargando(false)
    }
  }, [negocioId, fecha])

  useEffect(() => {
    const id = setTimeout(() => { void cargarDatos() }, 0)
    return () => clearTimeout(id)
  }, [cargarDatos])

  async function crearHorario() {
    if (!negocioId) return
    if (nuevoHorario.capacidad_total < 1) {
      setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
      return
    }
    if (nuevoHorario.hora_inicio >= nuevoHorario.hora_fin) {
      setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser mayor a la de inicio' })
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
        setMensaje({ tipo: 'error', texto: data.error ?? 'Error al crear horario' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Horario creado correctamente' })
        setMostrarForm(false)
        setNuevoHorario({
          dia_semana: 'lunes',
          hora_inicio: '07:00',
          hora_fin: '08:00',
          capacidad_total: 10,
        })
        cargarDatos()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' })
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
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo actualizar el horario' })
      } else {
        cargarDatos()
      }
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
        cargarDatos()
      }
    } finally {
      setActualizandoId(null)
    }
  }

  async function eliminarHorario(horarioId: string) {
    if (!confirm('¿Eliminar este horario permanentemente?')) return
    const res = await fetch(`/api/negocio/horarios/${horarioId}`, { method: 'DELETE' })
    if (res.ok) {
      setMensaje({ tipo: 'ok', texto: 'Horario eliminado' })
      cargarDatos()
    } else {
      const data = await res.json()
      setMensaje({ tipo: 'error', texto: data.error ?? 'Error al eliminar horario' })
    }
  }

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
        setMensaje({ tipo: 'ok', texto: 'Reservación completada' })
        cargarDatos()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' })
    } finally {
      setCompletandoId(null)
    }
  }

  const inputCls = 'w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20'

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <h1 className="text-2xl font-black tracking-tight text-white">Panel de negocio</h1>
        <p className="mt-1 text-sm text-white/40">Gestión de horarios y reservaciones</p>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Negocio</label>
            <select value={negocioId} onChange={e => setNegocioId(e.target.value)} className={inputCls}>
              <option value="">Selecciona un negocio...</option>
              {negocios.map(n => (
                <option key={n.id} value={n.id}>
                  {n.nombre} — {n.ciudad.charAt(0).toUpperCase() + n.ciudad.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
        </div>

        {mensaje && (
          <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            mensaje.tipo === 'ok'
              ? 'bg-[#E8FF47]/20 text-[#0A0A0A] ring-1 ring-[#E8FF47]'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {cargando && <p className="text-center text-sm text-[#888]">Cargando...</p>}

        {negocioId && !cargando && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#888]">
              Reservaciones · {new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
            </h2>

            {reservaciones.length === 0 ? (
              <p className="text-sm text-[#888]">Sin reservaciones para esta fecha.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reservaciones.map(r => {
                  const horario = obtenerRelacion(r.horarios)
                  const usuario = obtenerRelacion(r.users)
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0A0A0A]">{usuario?.nombre ?? 'Usuario'}</p>
                        <p className="text-xs text-[#888]">
                          {horario ? `${formatHora(horario.hora_inicio)} – ${formatHora(horario.hora_fin)}` : 'Horario no disponible'}
                        </p>
                      </div>
                      {r.estado === 'confirmada' && (
                        <button
                          onClick={() => completarReservacion(r.id)}
                          disabled={completandoId === r.id}
                          className="shrink-0 rounded-md bg-[#0A0A0A] px-2.5 py-1 text-[10px] font-bold uppercase text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                        >
                          {completandoId === r.id ? 'Procesando' : 'Completar'}
                        </button>
                      )}
                      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                        r.estado === 'confirmada' ? 'bg-[#E8FF47]/30 text-[#0A0A0A]' :
                        r.estado === 'completada' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.estado}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {negocioId && !cargando && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Horarios</h2>
              <button
                onClick={() => setMostrarForm(v => !v)}
                className="rounded-lg bg-[#6B4FE8] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#5a3fd6]"
              >
                {mostrarForm ? 'Cancelar' : '+ Nuevo horario'}
              </button>
            </div>

            {mostrarForm && (
              <div className="mb-4 space-y-2.5 rounded-lg border border-[#6B4FE8]/20 bg-[#6B4FE8]/5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Día</label>
                    <select
                      value={nuevoHorario.dia_semana}
                      onChange={e => setNuevoHorario(h => ({ ...h, dia_semana: e.target.value as DiaSemana }))}
                      className={inputCls}
                    >
                      {DIAS.map(d => <option key={d} value={d}>{DIA_LABELS[d]}</option>)}
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
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Inicio</label>
                    <input
                      type="time"
                      value={nuevoHorario.hora_inicio}
                      onChange={e => setNuevoHorario(h => ({ ...h, hora_inicio: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Fin</label>
                    <input
                      type="time"
                      value={nuevoHorario.hora_fin}
                      onChange={e => setNuevoHorario(h => ({ ...h, hora_fin: e.target.value }))}
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

            {horarios.length === 0 ? (
              <p className="text-sm text-[#888]">Sin horarios configurados.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {horarios.map(h => (
                  <div
                    key={h.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                      h.activo ? 'border-[#E5E5E5] bg-white' : 'border-dashed border-[#E5E5E5] bg-[#F7F7F7]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#0A0A0A]">
                        {DIA_LABELS[h.dia_semana]} · {formatHora(h.hora_inicio)} – {formatHora(h.hora_fin)}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-[#888]">Capacidad</span>
                        <input
                          type="number"
                          min={1}
                          value={capacidadDraft[h.id] ?? h.capacidad_total}
                          onChange={e => setCapacidadDraft(prev => ({ ...prev, [h.id]: Number(e.target.value) }))}
                          className="w-20 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                        />
                        <button
                          onClick={() => actualizarCapacidad(h.id)}
                          disabled={actualizandoId === h.id}
                          className="rounded-md bg-[#6B4FE8] px-2 py-1 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-40"
                        >
                          Guardar
                        </button>
                        {!h.activo && <span className="text-xs font-semibold text-red-500">Inactivo</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => toggleActivo(h.id, h.activo)}
                        disabled={actualizandoId === h.id}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                          h.activo
                            ? 'bg-[#E5E5E5] text-[#888] hover:bg-red-100 hover:text-red-700'
                            : 'bg-[#E8FF47]/30 text-[#0A0A0A] hover:bg-[#E8FF47]/60'
                        } disabled:opacity-40`}
                      >
                        {h.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      {rol === 'admin' && (
                        <button
                          onClick={() => eliminarHorario(h.id)}
                          className="rounded-md bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 transition-colors hover:bg-red-200"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
