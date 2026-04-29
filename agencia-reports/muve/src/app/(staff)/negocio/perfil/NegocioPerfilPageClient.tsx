'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import { CATEGORIA_LABELS, CIUDAD_LABELS, type Categoria, type Ciudad } from '@/types'

type NegocioPerfil = {
  id: string
  nombre: string
  categoria: string
  ciudad: string
  nivel: 'basico' | 'plus' | 'total'
  direccion: string
  descripcion: string
  imagen_url: string | null
  instagram_handle: string
  tiktok_handle: string
  telefono_contacto: string
  email_contacto: string
  horario_atencion: string
  stripe_account_id: string | null
}
type ServicioDisponible = {
  id: string
  negocio_id: string
  nombre: string
  precio_normal_mxn: number
  descripcion: string | null
  activo: boolean
}

type ServicioDraft = {
  nombre: string
  precio_normal_mxn: string
  descripcion: string
}

const MAX_FOTO_SIZE_BYTES = 4 * 1024 * 1024
const MIME_TYPES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

function inicialesNegocio(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(fragmento => fragmento[0]?.toUpperCase() ?? '')
    .join('') || 'MU'
}

function ciudadLabel(ciudad: string) {
  return CIUDAD_LABELS[ciudad as Ciudad] ?? ciudad
}

function categoriaLabel(categoria: string) {
  return CATEGORIA_LABELS[categoria as Categoria] ?? categoria
}
function nivelLabel(nivel: 'basico' | 'plus' | 'total') {
  if (nivel === 'plus') return 'Plus'
  if (nivel === 'total') return 'Total'
  return 'Básico'
}

function normalizarHandleEnVista(value: string | null | undefined) {
  if (!value) return ''
  return value.startsWith('@') ? value : `@${value}`
}

function denormalizarHandleParaPayload(value: string) {
  return value.trim().replace(/^@+/, '')
}

export default function NegocioPerfilPageClient() {
  const inputFotoRef = useRef<HTMLInputElement | null>(null)
  const [perfil, setPerfil] = useState<NegocioPerfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [servicios, setServicios] = useState<ServicioDisponible[]>([])
  const [cargandoServicios, setCargandoServicios] = useState(false)
  const [guardandoServicio, setGuardandoServicio] = useState(false)
  const [actualizandoServicioId, setActualizandoServicioId] = useState<string | null>(null)
  const [editandoServicioId, setEditandoServicioId] = useState<string | null>(null)
  const [nuevoServicio, setNuevoServicio] = useState<ServicioDraft>({
    nombre: '',
    precio_normal_mxn: '',
    descripcion: '',
  })
  const [edicionServicio, setEdicionServicio] = useState<ServicioDraft | null>(null)

  const cargarServicios = useCallback(async (negocioId: string) => {
    setCargandoServicios(true)
    try {
      const res = await fetch(`/api/negocio/servicios?negocio_id=${encodeURIComponent(negocioId)}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({})) as {
        servicios?: Array<{
          id?: string
          negocio_id?: string
          nombre?: string
          precio_normal_mxn?: number
          descripcion?: string | null
          activo?: boolean
        }>
        error?: string
      }

      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudieron cargar los servicios disponibles',
        })
        setServicios([])
        return
      }

      const listaServicios = (data.servicios ?? [])
        .filter((servicio): servicio is NonNullable<typeof servicio> & { id: string; negocio_id: string; nombre: string } => (
          typeof servicio?.id === 'string'
          && typeof servicio?.negocio_id === 'string'
          && typeof servicio?.nombre === 'string'
        ))
        .map((servicio) => ({
          id: servicio.id,
          negocio_id: servicio.negocio_id,
          nombre: servicio.nombre,
          precio_normal_mxn: typeof servicio.precio_normal_mxn === 'number'
            ? Math.max(Math.trunc(servicio.precio_normal_mxn), 0)
            : 0,
          descripcion: typeof servicio.descripcion === 'string' ? servicio.descripcion : null,
          activo: Boolean(servicio.activo),
        }))
      setServicios(listaServicios)
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar los servicios disponibles' })
      setServicios([])
    } finally {
      setCargandoServicios(false)
    }
  }, [])

  useEffect(() => {
    let activo = true

    async function cargarPerfil() {
      setCargando(true)
      try {
        const res = await fetch('/api/negocio/perfil', { cache: 'no-store' })
        const data = await res.json().catch(() => ({})) as {
          negocio?: {
            id?: string
            nombre?: string
            categoria?: string
            ciudad?: string
            nivel?: 'basico' | 'plus' | 'total'
            direccion?: string
            descripcion?: string
            imagen_url?: string | null
            instagram_handle?: string | null
            tiktok_handle?: string | null
            telefono_contacto?: string | null
            email_contacto?: string | null
            horario_atencion?: string | null
            stripe_account_id?: string | null
          }
          error?: string
        }

        if (!activo) return

        if (res.status === 401) {
          window.location.assign('/login')
          return
        }
        if (!res.ok || !data.negocio?.id) {
          setPerfil(null)
          setMensaje({
            tipo: 'error',
            texto: typeof data.error === 'string'
              ? data.error
              : 'No se pudo cargar el perfil del negocio',
          })
          return
        }

        setPerfil({
          id: data.negocio.id,
          nombre: data.negocio.nombre ?? '',
          categoria: data.negocio.categoria ?? '',
          ciudad: data.negocio.ciudad ?? '',
          nivel: data.negocio.nivel === 'plus' || data.negocio.nivel === 'total' ? data.negocio.nivel : 'basico',
          direccion: data.negocio.direccion ?? '',
          descripcion: data.negocio.descripcion ?? '',
          imagen_url: data.negocio.imagen_url ?? null,
          instagram_handle: normalizarHandleEnVista(data.negocio.instagram_handle),
          tiktok_handle: normalizarHandleEnVista(data.negocio.tiktok_handle),
          telefono_contacto: data.negocio.telefono_contacto ?? '',
          email_contacto: data.negocio.email_contacto ?? '',
          horario_atencion: data.negocio.horario_atencion ?? '',
          stripe_account_id: data.negocio.stripe_account_id ?? null,
        })
      } catch {
        if (!activo) return
        setPerfil(null)
        setMensaje({
          tipo: 'error',
          texto: 'Error de conexión al cargar el perfil del negocio',
        })
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargarPerfil()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!perfil || perfil.categoria !== 'estetica') return
    const timeoutId = window.setTimeout(() => {
      void cargarServicios(perfil.id)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [cargarServicios, perfil])

  function actualizarCampo<K extends keyof NegocioPerfil>(campo: K, valor: NegocioPerfil[K]) {
    setPerfil((prev) => (prev ? { ...prev, [campo]: valor } : prev))
  }

  async function crearServicioDisponible() {
    if (!perfil) return

    const nombre = nuevoServicio.nombre.trim()
    const precio = Number.parseInt(nuevoServicio.precio_normal_mxn, 10)
    if (!nombre) {
      setMensaje({ tipo: 'error', texto: 'El nombre del servicio es obligatorio' })
      return
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setMensaje({ tipo: 'error', texto: 'El precio normal debe ser un entero mayor o igual a 0' })
      return
    }

    setGuardandoServicio(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/negocio/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: perfil.id,
          nombre,
          precio_normal_mxn: precio,
          descripcion: nuevoServicio.descripcion.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudo crear el servicio',
        })
        return
      }

      setNuevoServicio({ nombre: '', precio_normal_mxn: '', descripcion: '' })
      await cargarServicios(perfil.id)
      setMensaje({ tipo: 'ok', texto: 'Servicio creado correctamente' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al crear el servicio' })
    } finally {
      setGuardandoServicio(false)
    }
  }

  function iniciarEdicionServicio(servicio: ServicioDisponible) {
    setEditandoServicioId(servicio.id)
    setEdicionServicio({
      nombre: servicio.nombre,
      precio_normal_mxn: String(servicio.precio_normal_mxn),
      descripcion: servicio.descripcion ?? '',
    })
  }

  async function guardarEdicionServicio(servicioId: string) {
    if (!perfil || !edicionServicio) return

    const nombre = edicionServicio.nombre.trim()
    const precio = Number.parseInt(edicionServicio.precio_normal_mxn, 10)
    if (!nombre) {
      setMensaje({ tipo: 'error', texto: 'El nombre del servicio es obligatorio' })
      return
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setMensaje({ tipo: 'error', texto: 'El precio normal debe ser un entero mayor o igual a 0' })
      return
    }

    setActualizandoServicioId(servicioId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/servicios/${servicioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          precio_normal_mxn: precio,
          descripcion: edicionServicio.descripcion.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudo actualizar el servicio',
        })
        return
      }

      setEditandoServicioId(null)
      setEdicionServicio(null)
      await cargarServicios(perfil.id)
      setMensaje({ tipo: 'ok', texto: 'Servicio actualizado correctamente' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar el servicio' })
    } finally {
      setActualizandoServicioId(null)
    }
  }

  async function toggleServicioActivo(servicio: ServicioDisponible) {
    if (!perfil) return

    setActualizandoServicioId(servicio.id)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/servicios/${servicio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !servicio.activo }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudo actualizar el servicio',
        })
        return
      }

      await cargarServicios(perfil.id)
      setMensaje({
        tipo: 'ok',
        texto: servicio.activo ? 'Servicio desactivado' : 'Servicio activado',
      })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar el servicio' })
    } finally {
      setActualizandoServicioId(null)
    }
  }

  async function guardarPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!perfil) return

    setGuardando(true)
    setMensaje(null)

    try {
      const res = await fetch('/api/negocio/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: perfil.id,
          nombre: perfil.nombre,
          direccion: perfil.direccion,
          descripcion: perfil.descripcion,
          instagram_handle: denormalizarHandleParaPayload(perfil.instagram_handle),
          tiktok_handle: denormalizarHandleParaPayload(perfil.tiktok_handle),
          telefono_contacto: perfil.telefono_contacto,
          email_contacto: perfil.email_contacto,
          horario_atencion: perfil.horario_atencion,
        }),
      })

      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudo guardar el perfil del negocio',
        })
        return
      }

      setMensaje({ tipo: 'ok', texto: 'Perfil del negocio actualizado correctamente' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al guardar el perfil del negocio' })
    } finally {
      setGuardando(false)
    }
  }

  async function subirFotoNegocio(event: ChangeEvent<HTMLInputElement>) {
    if (!perfil) return

    const archivo = event.target.files?.[0]
    if (!archivo) return

    if (!MIME_TYPES_PERMITIDOS.includes(archivo.type)) {
      setMensaje({ tipo: 'error', texto: 'Formato no permitido. Usa JPG, PNG o WEBP.' })
      event.target.value = ''
      return
    }
    if (archivo.size > MAX_FOTO_SIZE_BYTES) {
      setMensaje({ tipo: 'error', texto: 'La imagen supera el límite de 4MB.' })
      event.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('negocio_id', perfil.id)
    formData.append('foto_negocio', archivo)

    setSubiendoFoto(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/negocio/imagen', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({})) as {
        negocio?: { imagen_url?: string | null }
        error?: string
      }

      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: typeof data.error === 'string'
            ? data.error
            : 'No se pudo actualizar la foto del negocio',
        })
        return
      }

      const imagenUrl = typeof data.negocio?.imagen_url === 'string'
        ? data.negocio.imagen_url
        : null
      setPerfil((prev) => (prev ? { ...prev, imagen_url: imagenUrl } : prev))
      setMensaje({ tipo: 'ok', texto: 'Foto del negocio actualizada correctamente' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al subir la foto del negocio' })
    } finally {
      setSubiendoFoto(false)
      event.target.value = ''
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#F7F7F7]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4">
          <p className="text-sm font-semibold text-[#666]">Cargando perfil del negocio...</p>
        </div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="min-h-screen bg-[#F7F7F7]">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4">
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-black text-red-800">No se pudo cargar el perfil del negocio</p>
            {mensaje && <p className="mt-1 text-xs text-red-700">{mensaje.texto}</p>}
            <Link
              href="/negocio/dashboard"
              className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-800"
            >
              Volver al dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const stripeConectado = Boolean(perfil.stripe_account_id)
  const enlaceStripe = stripeConectado
    ? '/api/negocio/stripe-connect?modo=gestionar'
    : '/api/negocio/stripe-connect'
  const esWellness = perfil.categoria === 'estetica'

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
            <h1 className="text-2xl font-black tracking-tight text-white">Perfil del negocio</h1>
            <p className="mt-1 text-sm text-white/50">
              Administra la información pública y de contacto de tu negocio.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/negocio/dashboard"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Dashboard
            </Link>
            <Link
              href="/negocio/horarios"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Horarios
            </Link>
            <Link
              href="/perfil"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Perfil usuario
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-3xl space-y-4 px-4">
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

        <form onSubmit={guardarPerfil} className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
          <div className="mb-6 flex flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#6B4FE8] text-2xl font-black text-[#E8FF47]">
              {perfil.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.imagen_url} alt={perfil.nombre} className="h-full w-full object-cover" />
              ) : (
                <span>{inicialesNegocio(perfil.nombre)}</span>
              )}
            </div>

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={subirFotoNegocio}
            />

            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={subiendoFoto}
              className="mt-3 rounded-lg border border-[#6B4FE8] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {subiendoFoto ? 'Subiendo foto...' : 'Subir logo/foto'}
            </button>
            <p className="mt-2 text-[11px] text-[#888]">Solo JPG, PNG o WEBP · máximo 4MB</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Nombre del negocio
              </label>
              <input
                type="text"
                value={perfil.nombre}
                onChange={(event) => actualizarCampo('nombre', event.target.value)}
                required
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Categoría (solo lectura)
                </label>
                <input
                  type="text"
                  value={categoriaLabel(perfil.categoria)}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-[#E5E5E5] bg-[#F3F4F6] px-3 py-2.5 text-sm text-[#666] outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Ciudad (solo lectura)
                </label>
                <input
                  type="text"
                  value={ciudadLabel(perfil.ciudad)}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-[#E5E5E5] bg-[#F3F4F6] px-3 py-2.5 text-sm text-[#666] outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Nivel (solo lectura)
                </label>
                <input
                  type="text"
                  value={nivelLabel(perfil.nivel)}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-[#E5E5E5] bg-[#F3F4F6] px-3 py-2.5 text-sm text-[#666] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Dirección
              </label>
              <input
                type="text"
                value={perfil.direccion}
                onChange={(event) => actualizarCampo('direccion', event.target.value)}
                required
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Descripción del negocio
              </label>
              <textarea
                value={perfil.descripcion}
                onChange={(event) => actualizarCampo('descripcion', event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Instagram handle
                </label>
                <input
                  type="text"
                  value={perfil.instagram_handle}
                  onChange={(event) => actualizarCampo('instagram_handle', event.target.value)}
                  placeholder="@tu_negocio"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  TikTok handle
                </label>
                <input
                  type="text"
                  value={perfil.tiktok_handle}
                  onChange={(event) => actualizarCampo('tiktok_handle', event.target.value)}
                  placeholder="@tu_negocio"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Teléfono de contacto
                </label>
                <input
                  type="tel"
                  value={perfil.telefono_contacto}
                  onChange={(event) => actualizarCampo('telefono_contacto', event.target.value)}
                  placeholder="(000) 000 0000"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Email de contacto
                </label>
                <input
                  type="email"
                  value={perfil.email_contacto}
                  onChange={(event) => actualizarCampo('email_contacto', event.target.value)}
                  placeholder="contacto@negocio.com"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Horario de atención
              </label>
              <input
                type="text"
                value={perfil.horario_atencion}
                onChange={(event) => actualizarCampo('horario_atencion', event.target.value)}
                placeholder="Lunes-Viernes 6am-10pm"
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Cuenta Stripe conectada (solo lectura)
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#0A0A0A]">
                  {stripeConectado ? 'Conectada' : 'No conectada'}
                </p>
                <a
                  href={enlaceStripe}
                  className="inline-flex rounded-lg border border-[#6B4FE8] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white"
                >
                  {stripeConectado ? 'Gestionar cuenta' : 'Conectar cuenta'}
                </a>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="mt-6 w-full rounded-lg bg-[#0A0A0A] py-3 text-sm font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar perfil del negocio'}
          </button>
        </form>

        {esWellness && (
          <section
            id="servicios-disponibles"
            className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm"
          >
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[#888]">
              Servicios disponibles
            </h2>
            <p className="mt-1 text-xs text-[#666]">
              Edita nombre, precio y estado de los servicios que se muestran a usuarios.
            </p>

            <div className="mt-3 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                    Nombre del servicio
                  </label>
                  <input
                    type="text"
                    value={nuevoServicio.nombre}
                    onChange={(event) => setNuevoServicio((prev) => ({ ...prev, nombre: event.target.value }))}
                    placeholder="Ej. Manicure básica"
                    className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                    Precio normal (MXN)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={nuevoServicio.precio_normal_mxn}
                    onChange={(event) => setNuevoServicio((prev) => ({ ...prev, precio_normal_mxn: event.target.value }))}
                    placeholder="350"
                    className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={nuevoServicio.descripcion}
                  onChange={(event) => setNuevoServicio((prev) => ({ ...prev, descripcion: event.target.value }))}
                  placeholder="Detalles del servicio"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </div>

              <button
                type="button"
                onClick={() => void crearServicioDisponible()}
                disabled={guardandoServicio}
                className="self-start rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoServicio ? 'Creando...' : 'Agregar servicio'}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {cargandoServicios ? (
                <p className="text-sm text-[#666]">Cargando servicios...</p>
              ) : servicios.length === 0 ? (
                <p className="text-sm text-[#666]">Aún no hay servicios disponibles.</p>
              ) : (
                servicios.map((servicio) => {
                  const editando = editandoServicioId === servicio.id && edicionServicio !== null
                  return (
                    <div
                      key={servicio.id}
                      className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3"
                    >
                      {editando ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                                Nombre
                              </label>
                              <input
                                type="text"
                                value={edicionServicio.nombre}
                                onChange={(event) => setEdicionServicio((prev) => (
                                  prev ? { ...prev, nombre: event.target.value } : prev
                                ))}
                                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                                Precio
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={edicionServicio.precio_normal_mxn}
                                onChange={(event) => setEdicionServicio((prev) => (
                                  prev ? { ...prev, precio_normal_mxn: event.target.value } : prev
                                ))}
                                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                              Descripción
                            </label>
                            <input
                              type="text"
                              value={edicionServicio.descripcion}
                              onChange={(event) => setEdicionServicio((prev) => (
                                prev ? { ...prev, descripcion: event.target.value } : prev
                              ))}
                              className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void guardarEdicionServicio(servicio.id)}
                              disabled={actualizandoServicioId === servicio.id}
                              className="rounded-lg bg-[#0A0A0A] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoServicioId(null)
                                setEdicionServicio(null)
                              }}
                              className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#666] transition-colors hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#0A0A0A]">{servicio.nombre}</p>
                            <p className="text-xs font-semibold text-[#6B4FE8]">
                              ${servicio.precio_normal_mxn.toLocaleString('es-MX')} MXN
                            </p>
                            {servicio.descripcion && (
                              <p className="mt-1 text-xs text-[#666]">{servicio.descripcion}</p>
                            )}
                            <span
                              className={`mt-2 inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                servicio.activo
                                  ? 'bg-[#E8FF47]/40 text-[#0A0A0A]'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {servicio.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => iniciarEdicionServicio(servicio)}
                              className="rounded-lg border border-[#6B4FE8] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleServicioActivo(servicio)}
                              disabled={actualizandoServicioId === servicio.id}
                              className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                servicio.activo
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-[#E8FF47]/30 text-[#0A0A0A] hover:bg-[#E8FF47]/60'
                              }`}
                            >
                              {servicio.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
