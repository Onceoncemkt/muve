'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import NegocioCard from '@/components/NegocioCard'
import { createClient } from '@/lib/supabase/client'
import type { Negocio, Ciudad, Categoria, DiaSemana } from '@/types'
import { CIUDAD_LABELS, CATEGORIA_LABELS, formatHora } from '@/types'

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

type Mensaje = { tipo: 'ok' | 'error'; texto: string }

function hoyLocalISO() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

function faltanColumnasOpcionalesNegocio(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column')
    && (message.includes('requiere_reserva') || message.includes('capacidad_default'))
}

export default function ExplorarPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargando, setCargando] = useState(true)
  const [ciudadFiltro, setCiudadFiltro] = useState<Ciudad | 'todas'>('todas')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | 'todas'>('todas')

  const [fechaReserva, setFechaReserva] = useState(hoyLocalISO())
  const [horariosPorNegocio, setHorariosPorNegocio] = useState<Record<string, HorarioDisponible[]>>({})
  const [negociosCargandoHorarios, setNegociosCargandoHorarios] = useState<string[]>([])
  const [erroresHorarios, setErroresHorarios] = useState<Record<string, string>>({})
  const [mensajesReserva, setMensajesReserva] = useState<Record<string, Mensaje>>({})
  const [reservandoHorarioId, setReservandoHorarioId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargarNegocios() {
      setCargando(true)
      const supabase = createClient()
      const consulta = await supabase
        .from('negocios')
        .select('id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, activo, requiere_reserva, capacidad_default')
        .eq('activo', true)
        .order('ciudad')
        .order('nombre')

      if (!activo) return

      if (!consulta.error) {
        setNegocios((consulta.data ?? []) as Negocio[])
        setCargando(false)
        return
      }

      if (faltanColumnasOpcionalesNegocio(consulta.error)) {
        type NegocioLegacy = Omit<Negocio, 'requiere_reserva' | 'capacidad_default'>
        const fallback = await supabase
          .from('negocios')
          .select('id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, activo')
          .eq('activo', true)
          .order('ciudad')
          .order('nombre')

        if (!activo) return

        if (!fallback.error) {
          const listaCompat = ((fallback.data ?? []) as NegocioLegacy[]).map(negocio => ({
            ...negocio,
            requiere_reserva: true,
            capacidad_default: 10,
          }))
          setNegocios(listaCompat)
        } else {
          setNegocios([])
        }
      } else {
        setNegocios([])
      }
      setCargando(false)
    }

    void cargarNegocios()
    return () => {
      activo = false
    }
  }, [])

  const negociosFiltrados = useMemo(() => {
    return negocios.filter(n => {
      const matchCiudad = ciudadFiltro === 'todas' || n.ciudad === ciudadFiltro
      const matchCategoria = categoriaFiltro === 'todas' || n.categoria === categoriaFiltro
      return matchCiudad && matchCategoria
    })
  }, [negocios, ciudadFiltro, categoriaFiltro])

  const idsCargandoHorarios = useMemo(() => new Set(negociosCargandoHorarios), [negociosCargandoHorarios])

  const cargarHorariosNegocio = useCallback(async (negocioId: string, fecha: string) => {
    const res = await fetch(
      `/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioId)}&fecha=${encodeURIComponent(fecha)}`
    )
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error ?? 'No se pudieron cargar horarios')
    }
    return (data.horarios ?? []) as HorarioDisponible[]
  }, [])

  useEffect(() => {
    let activo = true
    const negociosConReserva = negociosFiltrados.filter(n => n.requiere_reserva !== false)

    async function cargarTodos() {
      if (negociosConReserva.length === 0) {
        if (activo) setNegociosCargandoHorarios([])
        return
      }

      setNegociosCargandoHorarios(negociosConReserva.map(n => n.id))
      const resultados = await Promise.all(
        negociosConReserva.map(async negocio => {
          try {
            const horarios = await cargarHorariosNegocio(negocio.id, fechaReserva)
            return { negocioId: negocio.id, horarios, error: null as string | null }
          } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'No se pudieron cargar horarios'
            return { negocioId: negocio.id, horarios: [] as HorarioDisponible[], error: mensaje }
          }
        })
      )

      if (!activo) return

      setHorariosPorNegocio(prev => {
        const next = { ...prev }
        for (const resultado of resultados) {
          next[resultado.negocioId] = resultado.horarios
        }
        return next
      })

      setErroresHorarios(prev => {
        const next = { ...prev }
        for (const resultado of resultados) {
          if (resultado.error) {
            next[resultado.negocioId] = resultado.error
          } else {
            delete next[resultado.negocioId]
          }
        }
        return next
      })

      setNegociosCargandoHorarios([])
    }

    void cargarTodos()
    return () => {
      activo = false
    }
  }, [negociosFiltrados, fechaReserva, cargarHorariosNegocio])

  async function reservarHorario(negocioId: string, horarioId: string) {
    setReservandoHorarioId(horarioId)
    setMensajesReserva(prev => {
      const next = { ...prev }
      delete next[negocioId]
      return next
    })

    try {
      const res = await fetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario_id: horarioId, fecha: fechaReserva }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensajesReserva(prev => ({
          ...prev,
          [negocioId]: { tipo: 'error', texto: data.error ?? 'No se pudo crear la reservación' },
        }))
      } else {
        setMensajesReserva(prev => ({
          ...prev,
          [negocioId]: { tipo: 'ok', texto: 'Reservación creada con éxito' },
        }))
        const horariosActualizados = await cargarHorariosNegocio(negocioId, fechaReserva)
        setHorariosPorNegocio(prev => ({ ...prev, [negocioId]: horariosActualizados }))
        setErroresHorarios(prev => {
          const next = { ...prev }
          delete next[negocioId]
          return next
        })
      }
    } catch {
      setMensajesReserva(prev => ({
        ...prev,
        [negocioId]: { tipo: 'error', texto: 'Error de conexión al reservar' },
      }))
    } finally {
      setReservandoHorarioId(null)
    }
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
          <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2">
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Fecha de reservación</label>
            <input
              type="date"
              value={fechaReserva}
              min={hoyLocalISO()}
              onChange={e => setFechaReserva(e.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20"
            />
          </div>

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
            {negociosFiltrados.map(negocio => {
              const horariosNegocio = horariosPorNegocio[negocio.id] ?? []

              return (
                <div key={negocio.id} className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
                  <NegocioCard negocio={negocio} />
                  <div className="space-y-2 px-4 pb-4">
                    {negocio.requiere_reserva === false ? (
                      <p className="rounded-lg bg-[#E8FF47]/20 px-3 py-2 text-xs font-semibold text-[#0A0A0A]">
                        Llegar directo
                      </p>
                    ) : (
                      <>
                        {mensajesReserva[negocio.id] && (
                          <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            mensajesReserva[negocio.id].tipo === 'ok'
                              ? 'bg-[#E8FF47]/20 text-[#0A0A0A] ring-1 ring-[#E8FF47]'
                              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                          }`}>
                            {mensajesReserva[negocio.id].texto}
                          </div>
                        )}

                        {erroresHorarios[negocio.id] && (
                          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                            {erroresHorarios[negocio.id]}
                          </div>
                        )}

                        {idsCargandoHorarios.has(negocio.id) ? (
                          <p className="rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs text-[#888]">Cargando horarios...</p>
                        ) : horariosNegocio.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-[#E5E5E5] px-3 py-2 text-xs text-[#888]">
                            Sin horarios disponibles para la fecha seleccionada.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {horariosNegocio.map(horario => {
                              const spotsDisponibles = Math.max(horario.spots_disponibles, 0)
                              return (
                                <div key={horario.id} className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-[#0A0A0A]">
                                      {formatHora(horario.hora_inicio)} – {formatHora(horario.hora_fin)}
                                    </p>
                                    <p className="text-xs text-[#888]">
                                      {spotsDisponibles} de {horario.capacidad_total} spots libres
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => reservarHorario(negocio.id, horario.id)}
                                    disabled={spotsDisponibles <= 0 || reservandoHorarioId === horario.id}
                                    className="shrink-0 rounded-md bg-[#0A0A0A] px-2.5 py-1.5 text-[11px] font-bold text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {spotsDisponibles <= 0
                                      ? 'Lleno'
                                      : reservandoHorarioId === horario.id
                                        ? 'Reservando...'
                                        : 'Reservar'}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
