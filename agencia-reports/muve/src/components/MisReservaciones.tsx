'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatHora, type EstadoReserva } from '@/types'

type NegocioReserva = { id: string; nombre: string; direccion: string }
type HorarioReserva = {
  id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  capacidad_total: number
  negocios: NegocioReserva | NegocioReserva[] | null
}

interface ReservaUsuario {
  id: string
  fecha: string
  estado: EstadoReserva | string
  created_at: string
  horario_id?: string | null
  horarios: HorarioReserva | HorarioReserva[] | null
}

function normalizarRelacion<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function obtenerFechaHora(reserva: ReservaUsuario): Date | null {
  const horario = normalizarRelacion(reserva.horarios)
  if (!horario?.hora_inicio) return null
  const fechaHora = new Date(`${reserva.fecha}T${horario.hora_inicio}`)
  if (Number.isNaN(fechaHora.getTime())) return null
  return fechaHora
}

function etiquetaEstado(estado: string) {
  if (estado === 'confirmada') return 'bg-[#E8FF47]/30 text-[#0A0A0A]'
  if (estado === 'cancelada') return 'bg-red-200/80 text-red-900'
  if (estado === 'completada') return 'bg-white/20 text-white'
  return 'bg-white/10 text-white'
}

export default function MisReservaciones() {
  const [reservas, setReservas] = useState<ReservaUsuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())
  const [vistaActiva, setVistaActiva] = useState<'proximas' | 'historial'>('proximas')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/reservaciones')
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar tus reservaciones' })
        setReservas([])
        setAhoraMs(Date.now())
      } else {
        setReservas((data.reservaciones ?? []) as ReservaUsuario[])
        setAhoraMs(typeof data.now_ms === 'number' ? data.now_ms : Date.now())
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar reservaciones' })
      setReservas([])
      setAhoraMs(Date.now())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      void cargar()
    }, 0)
    return () => clearTimeout(id)
  }, [cargar])


  async function cancelarReserva(id: string) {
    setCancelandoId(id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/reservaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelada' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo cancelar la reservación' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Reservación cancelada' })
        void cargar()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cancelar reservación' })
    } finally {
      setCancelandoId(null)
    }
  }

  const reservasOrdenadas = useMemo(() => {
    return [...reservas].sort((a, b) => {
      const horarioA = normalizarRelacion(a.horarios)
      const horarioB = normalizarRelacion(b.horarios)
      const keyA = `${a.fecha}T${horarioA?.hora_inicio ?? '23:59:59'}`
      const keyB = `${b.fecha}T${horarioB?.hora_inicio ?? '23:59:59'}`
      return keyA.localeCompare(keyB)
    })
  }, [reservas])

  const reservasProximas = useMemo(() => {
    const hoyYmd = new Date(ahoraMs).toISOString().slice(0, 10)
    return reservasOrdenadas.filter(reserva => {
      return reserva.fecha >= hoyYmd && reserva.estado === 'confirmada'
    })
  }, [reservasOrdenadas, ahoraMs])

  const reservasHistorial = useMemo(() => {
    const hoyYmd = new Date(ahoraMs).toISOString().slice(0, 10)
    return reservasOrdenadas.filter(reserva => {
      return (
        reserva.fecha < hoyYmd
        || reserva.estado === 'completada'
        || reserva.estado === 'no_show'
        || reserva.estado === 'cancelada'
        || reserva.estado === 'cancelada_sin_devolucion'
      )
    }).reverse()
  }, [reservasOrdenadas, ahoraMs])

  return (
    <section className="mt-4 px-4">
      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-[#E8FF47]">Mis reservaciones</h2>

        {mensaje && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            mensaje.tipo === 'ok'
              ? 'bg-[#E8FF47]/20 text-[#E8FF47] ring-1 ring-[#E8FF47]/40'
              : 'bg-red-100 text-red-800 ring-1 ring-red-300'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {cargando ? (
          <p className="mt-3 text-sm text-white/60">Cargando reservaciones...</p>
        ) : reservasOrdenadas.length === 0 ? (
          <p className="mt-3 text-sm text-white/80">No tienes reservaciones</p>
        ) : (
          <div className="mt-3 space-y-6">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVistaActiva('proximas')}
                className={`rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
                  vistaActiva === 'proximas'
                    ? 'bg-[#E8FF47] text-[#0A0A0A]'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                Próximas
              </button>
              <button
                type="button"
                onClick={() => setVistaActiva('historial')}
                className={`rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
                  vistaActiva === 'historial'
                    ? 'bg-[#E8FF47] text-[#0A0A0A]'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                Historial
              </button>
            </div>
            <div>
              {vistaActiva === 'proximas' ? (
                <>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-white/60">Próximas</h3>
                  {reservasProximas.length === 0 ? (
                    <p className="mt-2 text-sm text-white/70">No tienes reservaciones próximas</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-white/15 text-[11px] uppercase tracking-widest text-white/60">
                            <th className="px-2 py-2 font-black">Fecha</th>
                            <th className="px-2 py-2 font-black">Negocio</th>
                            <th className="px-2 py-2 font-black">Horario</th>
                            <th className="px-2 py-2 font-black">Estado</th>
                            <th className="px-2 py-2 font-black">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reservasProximas.map(reserva => {
                            const horario = normalizarRelacion(reserva.horarios)
                            const negocio = normalizarRelacion(horario?.negocios)
                            const fechaHora = obtenerFechaHora(reserva)
                            const base = ahoraMs
                            const faltanMasDe2Horas = fechaHora ? fechaHora.getTime() - base > 2 * 60 * 60 * 1000 : false
                            const puedeCancelar = reserva.estado === 'confirmada' && faltanMasDe2Horas

                            return (
                              <tr key={reserva.id} className="border-b border-white/10 align-middle text-sm text-white/90 last:border-b-0">
                                <td className="px-2 py-2">
                                  {new Date(`${reserva.fecha}T00:00:00`).toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </td>
                                <td className="px-2 py-2 font-semibold text-white">{negocio?.nombre ?? 'Negocio'}</td>
                                <td className="px-2 py-2">
                                  {horario
                                    ? `${formatHora(horario.hora_inicio)} - ${formatHora(horario.hora_fin)}`
                                    : 'No disponible'}
                                </td>
                                <td className="px-2 py-2">
                                  <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${etiquetaEstado(reserva.estado)}`}>
                                    {reserva.estado}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  {puedeCancelar ? (
                                    <button
                                      onClick={() => cancelarReserva(reserva.id)}
                                      disabled={cancelandoId === reserva.id}
                                      className="rounded-md bg-[#6B4FE8] px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-40"
                                    >
                                      {cancelandoId === reserva.id ? 'Cancelando...' : 'Cancelar'}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-white/40">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-white/60">Historial</h3>
                  {reservasHistorial.length === 0 ? (
                    <p className="mt-2 text-sm text-white/70">Sin reservaciones anteriores</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-white/15 text-[11px] uppercase tracking-widest text-white/60">
                            <th className="px-2 py-2 font-black">Fecha</th>
                            <th className="px-2 py-2 font-black">Negocio</th>
                            <th className="px-2 py-2 font-black">Horario</th>
                            <th className="px-2 py-2 font-black">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reservasHistorial.map(reserva => {
                            const horario = normalizarRelacion(reserva.horarios)
                            const negocio = normalizarRelacion(horario?.negocios)
                            return (
                              <tr key={reserva.id} className="border-b border-white/10 align-middle text-sm text-white/90 last:border-b-0">
                                <td className="px-2 py-2">
                                  {new Date(`${reserva.fecha}T00:00:00`).toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </td>
                                <td className="px-2 py-2 font-semibold text-white">{negocio?.nombre ?? 'Negocio'}</td>
                                <td className="px-2 py-2">
                                  {horario
                                    ? `${formatHora(horario.hora_inicio)} - ${formatHora(horario.hora_fin)}`
                                    : 'No disponible'}
                                </td>
                                <td className="px-2 py-2">
                                  <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${etiquetaEstado(reserva.estado)}`}>
                                    {reserva.estado}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
