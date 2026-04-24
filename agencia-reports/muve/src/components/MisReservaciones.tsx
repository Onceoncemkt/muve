'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatHora } from '@/types'

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
  estado: string
  created_at: string
  horarios: HorarioReserva | HorarioReserva[] | null
}

function normalizarRelacion<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default function MisReservaciones() {
  const [reservas, setReservas] = useState<ReservaUsuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/reservaciones')
      const data = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar tus reservaciones' })
        setReservas([])
      } else {
        setReservas((data.reservaciones ?? []) as ReservaUsuario[])
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar reservaciones' })
      setReservas([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { void cargar() }, 0)
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
        cargar()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cancelar' })
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div className="mt-4 px-4">
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Mis reservaciones</h2>

        {mensaje && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            mensaje.tipo === 'ok'
              ? 'bg-[#E8FF47]/20 text-[#0A0A0A] ring-1 ring-[#E8FF47]'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {cargando ? (
          <p className="mt-3 text-sm text-[#888]">Cargando reservaciones...</p>
        ) : reservas.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm text-[#888]">No tienes reservaciones próximas.</p>
            <a
              href="/explorar"
              className="mt-3 inline-flex rounded-lg bg-[#6B4FE8] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#5a3fd6]"
            >
              Explorar horarios
            </a>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {reservas.map(r => {
              const horario = normalizarRelacion(r.horarios)
              const negocio = normalizarRelacion(horario?.negocios)
              const fechaHora = horario ? new Date(`${r.fecha}T${horario.hora_inicio}`) : null

              return (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0A0A0A]">{negocio?.nombre ?? 'Negocio'}</p>
                    <p className="text-xs text-[#888]">
                      {fechaHora
                        ? fechaHora.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
                        : r.fecha}
                      {horario ? ` · ${formatHora(horario.hora_inicio)}-${formatHora(horario.hora_fin)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => cancelarReserva(r.id)}
                    disabled={cancelandoId === r.id}
                    className="shrink-0 rounded-md border border-[#E5E5E5] px-2 py-1 text-[10px] font-bold uppercase text-[#888] transition-colors hover:border-red-200 hover:text-red-700 disabled:opacity-40"
                  >
                    {cancelandoId === r.id ? 'Cancelando' : 'Cancelar'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
