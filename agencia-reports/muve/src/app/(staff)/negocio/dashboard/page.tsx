'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import type { DiaSemana, EstadoReserva } from '@/types'
import { formatHora } from '@/types'

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

interface NegocioDashboard {
  id: string
  nombre: string
  ciudad: string
  categoria: string
  imagen_url?: string | null
  instagram_handle?: string | null
  tiktok_handle?: string | null
}

interface DashboardPayload {
  sin_negocio: boolean
  fecha: string
  negocio?: NegocioDashboard
  resumen?: {
    reservaciones_hoy: number
    horarios_activos: number
  }
  reservaciones?: ReservacionNegocio[]
  error?: string
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

function normalizarHandle(input: string | null | undefined) {
  if (!input) return null
  const limpio = input.trim().replace(/^@+/, '')
  return limpio.length > 0 ? limpio : null
}

function inicialesNegocio(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(fragmento => fragmento[0]?.toUpperCase() ?? '')
    .join('')
}

export default function NegocioDashboardPage() {
  const [fechaHoy] = useState(hoyLocalISO())
  const [negocio, setNegocio] = useState<NegocioDashboard | null>(null)
  const [reservaciones, setReservaciones] = useState<ReservacionNegocio[]>([])
  const [resumen, setResumen] = useState({ reservaciones_hoy: 0, horarios_activos: 0 })
  const [sinNegocio, setSinNegocio] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [completandoId, setCompletandoId] = useState<string | null>(null)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [instagramHandle, setInstagramHandle] = useState('')
  const [tiktokHandle, setTiktokHandle] = useState('')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargarDashboard = useCallback(async () => {
    setCargando(true)
    setMensaje(null)

    try {
      const res = await fetch(`/api/negocio/dashboard?fecha=${encodeURIComponent(fechaHoy)}`)
      const data = (await res.json().catch(() => ({}))) as DashboardPayload

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar datos del panel' })
        setNegocio(null)
        setInstagramHandle('')
        setTiktokHandle('')
        setSinNegocio(false)
        setReservaciones([])
        setResumen({ reservaciones_hoy: 0, horarios_activos: 0 })
        return
      }
      const negocioPerfil = data.negocio ?? null

      if (data.sin_negocio) {
        setSinNegocio(true)
        setNegocio(null)
        setInstagramHandle('')
        setTiktokHandle('')
        setReservaciones([])
        setResumen({ reservaciones_hoy: 0, horarios_activos: 0 })
        return
      }

      setSinNegocio(false)
      setNegocio(negocioPerfil)
      setInstagramHandle(negocioPerfil?.instagram_handle ? `@${negocioPerfil.instagram_handle}` : '')
      setTiktokHandle(negocioPerfil?.tiktok_handle ? `@${negocioPerfil.tiktok_handle}` : '')
      setReservaciones((data.reservaciones ?? []) as ReservacionNegocio[])
      setResumen({
        reservaciones_hoy: data.resumen?.reservaciones_hoy ?? 0,
        horarios_activos: data.resumen?.horarios_activos ?? 0,
      })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar el panel' })
      setNegocio(null)
      setInstagramHandle('')
      setTiktokHandle('')
      setSinNegocio(false)
      setReservaciones([])
      setResumen({ reservaciones_hoy: 0, horarios_activos: 0 })
    } finally {
      setCargando(false)
    }
  }, [fechaHoy])

  useEffect(() => {
    const id = setTimeout(() => {
      void cargarDashboard()
    }, 0)
    return () => clearTimeout(id)
  }, [cargarDashboard])

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
        void cargarDashboard()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al completar reservación' })
    } finally {
      setCompletandoId(null)
    }
  }

  async function guardarPerfilNegocio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!negocio) return

    setGuardandoPerfil(true)
    setMensaje(null)

    try {
      const res = await fetch('/api/negocio/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_handle: instagramHandle,
          tiktok_handle: tiktokHandle,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string' ? data.error : 'No se pudo guardar el perfil del negocio',
        })
        return
      }

      const instagramActualizado = normalizarHandle(data.negocio?.instagram_handle)
      const tiktokActualizado = normalizarHandle(data.negocio?.tiktok_handle)

      setNegocio(prev => prev ? {
        ...prev,
        instagram_handle: instagramActualizado,
        tiktok_handle: tiktokActualizado,
      } : prev)
      setInstagramHandle(instagramActualizado ? `@${instagramActualizado}` : '')
      setTiktokHandle(tiktokActualizado ? `@${tiktokActualizado}` : '')
      setMensaje({ tipo: 'ok', texto: 'Perfil del negocio actualizado correctamente' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al guardar el perfil del negocio' })
    } finally {
      setGuardandoPerfil(false)
    }
  }

  async function subirFotoNegocio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!negocio) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const archivo = formData.get('foto_negocio')
    if (!archivo || typeof archivo === 'string' || archivo.size <= 0) {
      setMensaje({ tipo: 'error', texto: 'Selecciona una imagen antes de subirla.' })
      return
    }

    setSubiendoFoto(true)
    setMensaje(null)

    try {
      const res = await fetch('/api/negocio/imagen', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string' ? data.error : 'No se pudo actualizar la foto del negocio',
        })
        return
      }

      const imagenUrl = typeof data.negocio?.imagen_url === 'string' ? data.negocio.imagen_url : null
      setNegocio(prev => prev ? { ...prev, imagen_url: imagenUrl } : prev)
      setMensaje({ tipo: 'ok', texto: 'Foto del negocio actualizada correctamente' })
      form.reset()
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al subir la foto del negocio' })
    } finally {
      setSubiendoFoto(false)
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

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/negocio/dashboard"
              className="text-xs font-bold uppercase tracking-widest text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-white">Panel de negocio</h1>
            <p className="mt-1 text-sm text-white/40">Reservaciones de hoy y operación de tu negocio asignado</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/negocio/dashboard"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Inicio
            </Link>
            <Link
              href="/negocio/horarios"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Horarios
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-xs font-semibold text-[#555]">
          Hoy: {new Date(`${fechaHoy}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
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

        {sinNegocio && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A]">
              Tu cuenta aún no tiene un negocio asignado. Contacta al administrador.
            </p>
          </div>
        )}

        {!sinNegocio && negocio && (
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Mi negocio</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <div className="h-28 w-full overflow-hidden rounded-lg border border-[#E5E5E5] sm:w-40">
                  {negocio.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={negocio.imagen_url}
                      alt={negocio.nombre}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#6B4FE8] text-3xl font-black tracking-tight text-[#E8FF47]">
                      {inicialesNegocio(negocio.nombre)}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-lg font-black text-[#0A0A0A]">{negocio.nombre}</p>
                  <p className="text-xs text-[#666]">
                    {negocio.ciudad.charAt(0).toUpperCase() + negocio.ciudad.slice(1)} · {negocio.categoria}
                  </p>

                  <form onSubmit={subirFotoNegocio} className="mt-3 flex flex-col gap-2">
                    <input
                      type="file"
                      name="foto_negocio"
                      accept="image/*"
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#555] file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]"
                    />
                    <button
                      type="submit"
                      disabled={subiendoFoto}
                      className="self-start rounded-lg bg-[#0A0A0A] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {subiendoFoto ? 'Subiendo...' : 'Subir / cambiar foto'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Reservaciones del día</p>
              <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{resumen.reservaciones_hoy}</p>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Horarios activos</p>
              <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{resumen.horarios_activos}</p>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#888]">Escáner QR</p>
              <Link
                href="/validar"
                className="inline-flex rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222]"
              >
                Abrir escáner QR
              </Link>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 md:col-span-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#888]">Perfil del negocio</p>
              <p className="mt-1 text-xs text-[#666]">
                Completa tus redes para que aparezcan en las cards del panel de usuario.
              </p>

              <form onSubmit={guardarPerfilNegocio} className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#555]">Instagram</span>
                    <input
                      type="text"
                      value={instagramHandle}
                      onChange={event => setInstagramHandle(event.target.value)}
                      placeholder="@tu_negocio"
                      className="mt-1 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#555]">TikTok</span>
                    <input
                      type="text"
                      value={tiktokHandle}
                      onChange={event => setTiktokHandle(event.target.value)}
                      placeholder="@tu_negocio"
                      className="mt-1 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={guardandoPerfil}
                  className="rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
                </button>
              </form>
            </div>
          </section>
        )}

        {cargando && <p className="text-center text-sm text-[#888]">Cargando reservaciones...</p>}

        {!cargando && !sinNegocio && negocio && gruposPorHorario.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A]">Sin reservaciones para hoy</p>
            <p className="mt-1 text-xs text-[#888]">{negocio.nombre} no tiene reservaciones confirmadas/completadas hoy.</p>
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
