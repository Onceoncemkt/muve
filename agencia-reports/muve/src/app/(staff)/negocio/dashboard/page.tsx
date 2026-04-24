'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import type { DiaSemana, EstadoReserva } from '@/types'
import { formatHora } from '@/types'

interface NegocioOption {
  id: string
  nombre: string
  ciudad: string
}

type UsuarioReserva = { id: string; nombre: string; email: string }
type HorarioReserva = { id: string; dia_semana: DiaSemana; hora_inicio: string; hora_fin: string }

interface ReservacionNegocio {
  id: string
  fecha: string
  estado: EstadoReserva | string
  created_at: string
  users: UsuarioReserva | UsuarioReserva[] | null
  horarios: HorarioReserva | HorarioReserva[] | null
}

interface GrupoHorario {
  key: string
  horario: HorarioReserva | null
  reservaciones: ReservacionNegocio[]
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

export default function NegocioDashboardPage() {
  const [negocios, setNegocios] = useState<NegocioOption[]>([])
  const [negocioId, setNegocioId] = useState('')
  const [fechaHoy] = useState(hoyLocalISO())
  const [reservaciones, setReservaciones] = useState<ReservacionNegocio[]>([])

  const [cargando, setCargando] = useState(false)
  const [completandoId, setCompletandoId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    let activo = true

    async function cargarNegocios() {
      const supabase = createClient()
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

    void cargarNegocios()
    return () => {
      activo = false
    }
  }, [])

  const cargarReservaciones = useCallback(async () => {
    if (!negocioId) {
      setReservaciones([])
      return
    }

    setCargando(true)
    setMensaje(null)

    try {
      const res = await fetch(
        `/api/negocio/reservaciones?negocio_id=${encodeURIComponent(negocioId)}&fecha=${encodeURIComponent(fechaHoy)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar reservaciones' })
        setReservaciones([])
      } else {
        setReservaciones((data.reservaciones ?? []) as ReservacionNegocio[])
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar reservaciones' })
      setReservaciones([])
    } finally {
      setCargando(false)
    }
  }, [negocioId, fechaHoy])

  useEffect(() => {
    const id = setTimeout(() => {
      void cargarReservaciones()
    }, 0)
    return () => clearTimeout(id)
  }, [cargarReservaciones])

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
        void cargarReservaciones()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al completar reservación' })
    } finally {
      setCompletandoId(null)
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

  const negocioActual = negocios.find(n => n.id === negocioId)
  const inputCls = 'w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20'

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Panel de negocio</h1>
            <p className="mt-1 text-sm text-white/40">Reservaciones de hoy agrupadas por horario</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/validar"
              className="rounded-lg bg-[#E8FF47] px-3 py-2 text-xs font-black uppercase tracking-widest text-[#0A0A0A] transition-colors hover:bg-white"
            >
              Escanear QR
            </Link>
            <Link
              href="/negocio/horarios"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-white/40"
            >
              Horarios
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
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
          <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-xs font-semibold text-[#555]">
            Hoy: {new Date(`${fechaHoy}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
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

        {cargando && <p className="text-center text-sm text-[#888]">Cargando reservaciones...</p>}

        {!cargando && negocioId && gruposPorHorario.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A]">Sin reservaciones para hoy</p>
            <p className="mt-1 text-xs text-[#888]">{negocioActual?.nombre ?? 'Este negocio'} no tiene reservaciones confirmadas/completadas hoy.</p>
          </div>
        )}

        {!cargando && gruposPorHorario.length > 0 && (
          <div className="space-y-3">
            {gruposPorHorario.map(grupo => (
              <section key={grupo.key} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#0A0A0A]">
                    {grupo.horario
                      ? `${formatHora(grupo.horario.hora_inicio)} – ${formatHora(grupo.horario.hora_fin)}`
                      : 'Horario no disponible'}
                  </h2>
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
