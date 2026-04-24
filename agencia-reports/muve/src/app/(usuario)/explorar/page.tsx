'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import NegocioCard from '@/components/NegocioCard'
import { createClient } from '@/lib/supabase/client'
import type { Negocio, Ciudad, Categoria, DiaSemana } from '@/types'
import { CIUDAD_LABELS, CATEGORIA_LABELS, DIA_LABELS, formatHora } from '@/types'

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']

interface HorarioDisponible {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  capacidad_total: number
  spots_disponibles: number
  spots_ocupados: number
}

function hoyLocalISO() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export default function ExplorarPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargando, setCargando] = useState(true)
  const [ciudadFiltro, setCiudadFiltro] = useState<Ciudad | 'todas'>('todas')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | 'todas'>('todas')

  const [negocioSeleccionado, setNegocioSeleccionado] = useState<Negocio | null>(null)
  const [fechaReserva, setFechaReserva] = useState(hoyLocalISO())
  const [horarios, setHorarios] = useState<HorarioDisponible[]>([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [reservandoHorarioId, setReservandoHorarioId] = useState<string | null>(null)
  const [mensajeModal, setMensajeModal] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    let activo = true
    async function cargarNegocios() {
      setCargando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('negocios')
        .select('id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, activo, visitas_permitidas_por_mes, requiere_reserva')
        .eq('activo', true)
        .order('ciudad')
        .order('nombre')

      if (!activo) return
      setNegocios((data ?? []) as Negocio[])
      setCargando(false)
    }
    cargarNegocios()
    return () => { activo = false }
  }, [])

  const cargarHorarios = useCallback(async (negocioId: string, fecha: string) => {
    setCargandoHorarios(true)
    setMensajeModal(null)
    try {
      const res = await fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioId)}&fecha=${encodeURIComponent(fecha)}`)
      const data = await res.json()
      if (!res.ok) {
        setMensajeModal({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar horarios' })
        setHorarios([])
      } else {
        setHorarios((data.horarios ?? []) as HorarioDisponible[])
      }
    } catch {
      setMensajeModal({ tipo: 'error', texto: 'Error de conexión al consultar horarios' })
      setHorarios([])
    } finally {
      setCargandoHorarios(false)
    }
  }, [])

  useEffect(() => {
    if (!negocioSeleccionado) return
    if (negocioSeleccionado.requiere_reserva === false) return
    const id = setTimeout(() => {
      void cargarHorarios(negocioSeleccionado.id, fechaReserva)
    }, 0)
    return () => clearTimeout(id)
  }, [negocioSeleccionado, fechaReserva, cargarHorarios])

  const negociosFiltrados = useMemo(() => {
    return negocios.filter(n => {
      const matchCiudad = ciudadFiltro === 'todas' || n.ciudad === ciudadFiltro
      const matchCategoria = categoriaFiltro === 'todas' || n.categoria === categoriaFiltro
      return matchCiudad && matchCategoria
    })
  }, [negocios, ciudadFiltro, categoriaFiltro])

  async function reservarHorario(horarioId: string) {
    setReservandoHorarioId(horarioId)
    setMensajeModal(null)
    try {
      const res = await fetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario_id: horarioId, fecha: fechaReserva }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensajeModal({ tipo: 'error', texto: data.error ?? 'No se pudo crear la reservación' })
      } else {
        setMensajeModal({ tipo: 'ok', texto: 'Reservación creada con éxito' })
        if (negocioSeleccionado) {
          cargarHorarios(negocioSeleccionado.id, fechaReserva)
        }
      }
    } catch {
      setMensajeModal({ tipo: 'error', texto: 'Error de conexión al reservar' })
    } finally {
      setReservandoHorarioId(null)
    }
  }

  function abrirModal(negocio: Negocio) {
    setNegocioSeleccionado(negocio)
    setFechaReserva(hoyLocalISO())
    setMensajeModal(null)
    setHorarios([])
  }

  const btnBase = 'shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors'
  const btnActive = 'bg-[#0A0A0A] text-white'
  const btnInactive = 'border border-[#E5E5E5] bg-white text-[#888] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Explorar</h1>
        <p className="mt-1 text-sm text-[#888]">
          {negociosFiltrados.length} {negociosFiltrados.length === 1 ? 'lugar' : 'lugares'} disponibles
        </p>
      </div>

      <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-4 py-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <button onClick={() => setCiudadFiltro('todas')} className={`${btnBase} ${ciudadFiltro === 'todas' ? btnActive : btnInactive}`}>Todas</button>
            {CIUDADES.map(c => (
              <button key={c} onClick={() => setCiudadFiltro(c)} className={`${btnBase} ${ciudadFiltro === c ? btnActive : btnInactive}`}>
                {CIUDAD_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <button onClick={() => setCategoriaFiltro('todas')} className={`${btnBase} ${categoriaFiltro === 'todas' ? 'bg-[#6B4FE8] text-white' : btnInactive}`}>Todo</button>
            {CATEGORIAS.map(c => (
              <button key={c} onClick={() => setCategoriaFiltro(c)} className={`${btnBase} ${categoriaFiltro === c ? 'bg-[#6B4FE8] text-white' : btnInactive}`}>
                {CATEGORIA_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4">
        {cargando ? (
          <p className="mt-8 text-center text-sm text-[#888]">Cargando negocios...</p>
        ) : negociosFiltrados.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-bold text-[#0A0A0A]">Sin resultados</p>
            <p className="mt-1 text-sm text-[#888]">Prueba con otros filtros.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negociosFiltrados.map(negocio => (
              <div key={negocio.id} className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
                <NegocioCard negocio={negocio} />
                <div className="px-4 pb-4">
                  {negocio.requiere_reserva === false ? (
                    <p className="rounded-lg bg-[#E8FF47]/20 px-3 py-2 text-xs font-semibold text-[#0A0A0A]">
                      Acceso directo (sin reservación)
                    </p>
                  ) : (
                    <button
                      onClick={() => abrirModal(negocio)}
                      className="w-full rounded-lg bg-[#6B4FE8] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6]"
                    >
                      Ver horarios y reservar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {negocioSeleccionado && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Reservar</p>
                <h2 className="text-lg font-black text-[#0A0A0A]">{negocioSeleccionado.nombre}</h2>
              </div>
              <button
                onClick={() => setNegocioSeleccionado(null)}
                className="rounded-md border border-[#E5E5E5] px-2 py-1 text-xs font-bold text-[#888] hover:text-[#0A0A0A]"
              >
                Cerrar
              </button>
            </div>

            {negocioSeleccionado.requiere_reserva === false ? (
              <p className="rounded-lg bg-[#E8FF47]/20 px-3 py-2 text-sm text-[#0A0A0A]">
                Este negocio permite acceso directo sin reservar.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Fecha</label>
                  <input
                    type="date"
                    value={fechaReserva}
                    min={hoyLocalISO()}
                    onChange={e => setFechaReserva(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20"
                  />
                </div>

                {mensajeModal && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    mensajeModal.tipo === 'ok'
                      ? 'bg-[#E8FF47]/20 text-[#0A0A0A] ring-1 ring-[#E8FF47]'
                      : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  }`}>
                    {mensajeModal.texto}
                  </div>
                )}

                {cargandoHorarios ? (
                  <p className="text-sm text-[#888]">Cargando horarios...</p>
                ) : horarios.length === 0 ? (
                  <p className="text-sm text-[#888]">Sin horarios disponibles para esa fecha.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {horarios.map(h => (
                      <div key={h.id} className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#0A0A0A]">
                            {DIA_LABELS[h.dia_semana]} · {formatHora(h.hora_inicio)} – {formatHora(h.hora_fin)}
                          </p>
                          <p className="text-xs text-[#888]">
                            {h.spots_disponibles} de {h.capacidad_total} lugares disponibles
                          </p>
                        </div>
                        <button
                          onClick={() => reservarHorario(h.id)}
                          disabled={h.spots_disponibles <= 0 || reservandoHorarioId === h.id}
                          className="shrink-0 rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-[11px] font-bold text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {h.spots_disponibles <= 0
                            ? 'Lleno'
                            : reservandoHorarioId === h.id
                              ? 'Reservando...'
                              : 'Reservar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
