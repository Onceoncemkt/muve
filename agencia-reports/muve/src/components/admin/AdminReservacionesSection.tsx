'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CIUDAD_LABELS, formatHora, type Ciudad, type EstadoReserva } from '@/types'

type NegocioOption = {
  id: string
  nombre: string
  ciudad: Ciudad
  categoria: string
  direccion: string
}

type ReservacionAdmin = {
  id: string
  user_id: string
  horario_id: string
  fecha: string
  estado: EstadoReserva | string
  creditos: number
  tipo_servicio_clase: string
  usuario: {
    id: string
    nombre: string
    email: string
    ciudad: Ciudad
  } | null
  horario: {
    id: string
    hora_inicio: string
    hora_fin: string
    tipo_clase: string | null
    nombre_coach: string | null
  } | null
  negocio: NegocioOption | null
}

type Resumen = {
  total_hoy: number
  confirmadas: number
  no_show: number
  canceladas: number
}

type HorarioDisponible = {
  id: string
  hora_inicio: string
  hora_fin: string
  spots_disponibles: number
}

function claseEstado(estado: string) {
  if (estado === 'confirmada') return 'bg-[#E8FF47]/30 text-[#0A0A0A]'
  if (estado === 'completada') return 'bg-green-100 text-green-800'
  if (estado === 'no_show') return 'bg-red-200 text-red-900'
  if (estado === 'cancelada') return 'bg-white/15 text-white'
  return 'bg-white/10 text-white'
}

export default function AdminReservacionesSection() {
  const [reservaciones, setReservaciones] = useState<ReservacionAdmin[]>([])
  const [resumen, setResumen] = useState<Resumen>({
    total_hoy: 0,
    confirmadas: 0,
    no_show: 0,
    canceladas: 0,
  })
  const [ciudades, setCiudades] = useState<Ciudad[]>([])
  const [negocios, setNegocios] = useState<NegocioOption[]>([])
  const [q, setQ] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [negocioId, setNegocioId] = useState('')
  const [fecha, setFecha] = useState('')
  const [estado, setEstado] = useState('confirmada')
  const [cargando, setCargando] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [editar, setEditar] = useState<ReservacionAdmin | null>(null)
  const [editNegocioId, setEditNegocioId] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editHorarioId, setEditHorarioId] = useState('')
  const [horariosDisponibles, setHorariosDisponibles] = useState<HorarioDisponible[]>([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setMensaje(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (ciudad) params.set('ciudad', ciudad)
      if (negocioId) params.set('negocio_id', negocioId)
      if (fecha) params.set('fecha', fecha)
      if (estado) params.set('estado', estado)

      const res = await fetch(`/api/admin/reservaciones?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar reservaciones' })
        setReservaciones([])
        return
      }

      setReservaciones((data.reservaciones ?? []) as ReservacionAdmin[])
      setResumen((data.resumen ?? {
        total_hoy: 0,
        confirmadas: 0,
        no_show: 0,
        canceladas: 0,
      }) as Resumen)
      setCiudades((data.filtros?.ciudades ?? []) as Ciudad[])
      setNegocios((data.filtros?.negocios ?? []) as NegocioOption[])
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar reservaciones' })
      setReservaciones([])
    } finally {
      setCargando(false)
    }
  }, [q, ciudad, negocioId, fecha, estado])

  useEffect(() => {
    const id = setTimeout(() => { void cargar() }, 0)
    return () => clearTimeout(id)
  }, [cargar])

  const cargarHorariosDisponibles = useCallback(async (negocioIdParam: string, fechaParam: string) => {
    if (!negocioIdParam || !fechaParam) {
      setHorariosDisponibles([])
      return
    }
    setCargandoHorarios(true)
    try {
      const res = await fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioIdParam)}&fecha=${encodeURIComponent(fechaParam)}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setHorariosDisponibles([])
        return
      }
      const horarios = ((data.horarios ?? []) as Array<{
        id: string
        hora_inicio: string
        hora_fin: string
        spots_disponibles?: number
      }>).map((horario) => ({
        id: horario.id,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
        spots_disponibles: typeof horario.spots_disponibles === 'number' ? horario.spots_disponibles : 0,
      }))
      setHorariosDisponibles(horarios)
    } finally {
      setCargandoHorarios(false)
    }
  }, [])

  const cambiarEstado = useCallback(async (id: string, nuevoEstado: 'cancelada' | 'completada' | 'no_show') => {
    setProcesandoId(id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/admin/reservaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo actualizar la reservación' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Reservación actualizada' })
        void cargar()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar reservación' })
    } finally {
      setProcesandoId(null)
    }
  }, [cargar])

  function abrirEditar(item: ReservacionAdmin) {
    setEditar(item)
    setEditNegocioId(item.negocio?.id ?? '')
    setEditFecha(item.fecha)
    setEditHorarioId(item.horario_id)
    void cargarHorariosDisponibles(item.negocio?.id ?? '', item.fecha)
  }

  async function guardarEdicion() {
    if (!editar) return
    if (!editNegocioId || !editFecha || !editHorarioId) {
      setMensaje({ tipo: 'error', texto: 'Selecciona negocio, fecha y horario' })
      return
    }
    setProcesandoId(editar.id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/admin/reservaciones/${editar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: editNegocioId,
          fecha: editFecha,
          horario_id: editHorarioId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo editar la reservación' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Reservación editada correctamente' })
        setEditar(null)
        void cargar()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al editar reservación' })
    } finally {
      setProcesandoId(null)
    }
  }

  const cards = useMemo(() => ([
    { label: 'Total reservaciones hoy', value: resumen.total_hoy },
    { label: 'Confirmadas', value: resumen.confirmadas },
    { label: 'No-shows', value: resumen.no_show },
    { label: 'Canceladas', value: resumen.canceladas },
  ]), [resumen])

  return (
    <section id="reservaciones" className="scroll-mt-24">
      <div className="mb-3">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">Reservaciones</h2>
        <p className="mt-1 text-xs text-white/50">Gestión administrativa de reservaciones y reprogramaciones.</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-[#111111] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">{card.label}</p>
            <p className="mt-1 text-2xl font-black text-[#E8FF47]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-[#111111] p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="text"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por usuario o negocio"
            className="rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          />
          <select
            value={ciudad}
            onChange={(event) => setCiudad(event.target.value)}
            className="rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          >
            <option value="">Todas las ciudades</option>
            {ciudades.map((item) => (
              <option key={item} value={item}>{CIUDAD_LABELS[item]}</option>
            ))}
          </select>
          <select
            value={negocioId}
            onChange={(event) => setNegocioId(event.target.value)}
            className="rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          >
            <option value="">Todos los negocios</option>
            {negocios.map((negocio) => (
              <option key={negocio.id} value={negocio.id}>{negocio.nombre}</option>
            ))}
          </select>
          <input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          />
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value)}
            className="rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          >
            <option value="confirmada">Confirmadas</option>
            <option value="completada">Completadas</option>
            <option value="no_show">No-show</option>
            <option value="cancelada">Canceladas</option>
            <option value="todos">Todos los estados</option>
          </select>
        </div>
      </div>

      {mensaje && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${
          mensaje.tipo === 'ok'
            ? 'bg-[#E8FF47]/20 text-[#E8FF47] ring-1 ring-[#E8FF47]/40'
            : 'bg-[#6B4FE8]/20 text-[#CBBEFF] ring-1 ring-[#6B4FE8]/40'
        }`}>
          {mensaje.texto}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full border-collapse bg-[#111111]">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
              <th className="px-3 py-3">Usuario</th>
              <th className="px-3 py-3">Negocio</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Hora</th>
              <th className="px-3 py-3">Clase/Servicio</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Créditos</th>
              <th className="px-3 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-white/60">Cargando reservaciones...</td>
              </tr>
            ) : reservaciones.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-white/60">No hay reservaciones para los filtros seleccionados.</td>
              </tr>
            ) : reservaciones.map((item) => (
              <tr key={item.id} className="border-b border-white/10 align-top text-sm text-white/90">
                <td className="px-3 py-3">
                  <p className="font-semibold">{item.usuario?.nombre ?? 'Usuario'}</p>
                  <p className="text-xs text-white/55">{item.usuario?.email ?? 'Sin email'}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold">{item.negocio?.nombre ?? 'Negocio'}</p>
                  <p className="text-xs text-white/55">{item.negocio?.direccion ?? 'Sin dirección'}</p>
                </td>
                <td className="px-3 py-3">
                  {new Date(`${item.fecha}T00:00:00`).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-3 py-3">
                  {item.horario ? `${formatHora(item.horario.hora_inicio)} - ${formatHora(item.horario.hora_fin)}` : 'N/D'}
                </td>
                <td className="px-3 py-3">{item.tipo_servicio_clase}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${claseEstado(item.estado)}`}>
                    {item.estado}
                  </span>
                </td>
                <td className="px-3 py-3 font-bold text-[#E8FF47]">{item.creditos}</td>
                <td className="px-3 py-3">
                  <div className="grid min-w-[13rem] grid-cols-2 gap-2">
                    <button
                      onClick={() => void cambiarEstado(item.id, 'cancelada')}
                      disabled={procesandoId === item.id}
                      className="rounded-md border border-white/20 px-2 py-1.5 text-xs font-bold text-white hover:border-[#E8FF47] hover:text-[#E8FF47] disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void cambiarEstado(item.id, 'completada')}
                      disabled={procesandoId === item.id}
                      className="rounded-md border border-white/20 px-2 py-1.5 text-xs font-bold text-white hover:border-[#E8FF47] hover:text-[#E8FF47] disabled:opacity-40"
                    >
                      Marcar asistió
                    </button>
                    <button
                      onClick={() => void cambiarEstado(item.id, 'no_show')}
                      disabled={procesandoId === item.id}
                      className="rounded-md border border-white/20 px-2 py-1.5 text-xs font-bold text-white hover:border-[#E8FF47] hover:text-[#E8FF47] disabled:opacity-40"
                    >
                      Marcar no-show
                    </button>
                    <button
                      onClick={() => abrirEditar(item)}
                      disabled={procesandoId === item.id}
                      className="rounded-md bg-[#6B4FE8] px-2 py-1.5 text-xs font-bold text-white hover:bg-[#5b40cd] disabled:opacity-40"
                    >
                      Cambiar fecha/hora
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-white/15 bg-[#111111] p-5">
            <h3 className="text-lg font-black text-[#E8FF47]">Editar reservación</h3>
            <p className="mt-1 text-sm text-white/60">{editar.usuario?.nombre ?? 'Usuario'} · {editar.negocio?.nombre ?? 'Negocio'}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/55">Negocio</label>
                <select
                  value={editNegocioId}
                  onChange={(event) => {
                    const value = event.target.value
                    setEditNegocioId(value)
                    setEditHorarioId('')
                    void cargarHorariosDisponibles(value, editFecha)
                  }}
                  className="w-full rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                >
                  <option value="">Selecciona negocio</option>
                  {negocios.map((negocio) => (
                    <option key={negocio.id} value={negocio.id}>{negocio.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/55">Fecha</label>
                <input
                  type="date"
                  value={editFecha}
                  onChange={(event) => {
                    const value = event.target.value
                    setEditFecha(value)
                    setEditHorarioId('')
                    void cargarHorariosDisponibles(editNegocioId, value)
                  }}
                  className="w-full rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/55">Horario disponible</label>
              <select
                value={editHorarioId}
                onChange={(event) => setEditHorarioId(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
              >
                <option value="">{cargandoHorarios ? 'Cargando horarios...' : 'Selecciona horario'}</option>
                {horariosDisponibles.map((horario) => (
                  <option key={horario.id} value={horario.id}>
                    {`${formatHora(horario.hora_inicio)} - ${formatHora(horario.hora_fin)} · Spots: ${horario.spots_disponibles}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditar(null)}
                className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Cerrar
              </button>
              <button
                onClick={() => void guardarEdicion()}
                disabled={procesandoId === editar.id}
                className="rounded-md bg-[#6B4FE8] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#5b40cd] disabled:opacity-40"
              >
                {procesandoId === editar.id ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
