'use client'

import Link from 'next/link'
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CIUDAD_LABELS, type Ciudad, type GeneroPerfil, type ObjetivoFitness } from '@/types'

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const MAX_FOTO_SIZE_BYTES = 2 * 1024 * 1024
const MIME_TYPES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const GENERO_OPTIONS: Array<{ value: GeneroPerfil; label: string }> = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
]

type PerfilFormState = {
  nombre: string
  email: string
  ciudad: Ciudad
  foto_url: string | null
  telefono: string
  fecha_nacimiento: string
  genero: GeneroPerfil | ''
  objetivo: ObjetivoFitness | ''
}
type ObjetivoOption = {
  value: ObjetivoFitness
  label: string
  description: string
  Icon: () => ReactElement
}
type Props = {
  userId: string
  initialProfile: PerfilFormState
  [key: string]: unknown
}


function inicialesDesdeTexto(value: string) {
  const iniciales = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((fragmento) => fragmento[0]?.toUpperCase() ?? '')
    .join('')
  return iniciales || 'MU'
}
function nombreBaseArchivoSeguro(nombre: string) {
  const baseSinExtension = nombre.replace(/\.[^.]+$/, '')
  return (
    baseSinExtension
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || `avatar-${Date.now()}`
  )
}
function extensionDesdeArchivo(file: File) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'jpeg') return 'jpg'
  if (extension === 'jpg' || extension === 'png' || extension === 'webp') return extension
  return null
}

function IconPerderPeso() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 4.5V19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 15L12 19.5 16.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconGanarMusculo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 10.5h2v3h-2v-3Zm13 0h2v3h-2v-3Zm-11 1.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 8.5v7M15 8.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function IconBienestar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 19.5s-6-3.7-6-8.2a3.7 3.7 0 0 1 6-2.8 3.7 3.7 0 0 1 6 2.8c0 4.5-6 8.2-6 8.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function IconFlexibilidad() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.75" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5.2l3.7 2.3M12 13.2l-3.7 2.3M7 20h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconEnergia() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M13 3.5 6.5 13h4l-.8 7.5L17.5 11h-4L13 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function IconSocial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15.25" cy="10.25" r="1.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.75 18a4.5 4.5 0 0 1 8.5 0M13.75 18a3.75 3.75 0 0 1 5.5-2.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const OBJETIVOS: ObjetivoOption[] = [
  { value: 'perder_peso', label: 'Perder peso', description: 'Reducir grasa', Icon: IconPerderPeso },
  { value: 'ganar_musculo', label: 'Ganar músculo', description: 'Fuerza y volumen', Icon: IconGanarMusculo },
  { value: 'bienestar', label: 'Bienestar', description: 'Salud integral', Icon: IconBienestar },
  { value: 'flexibilidad', label: 'Flexibilidad', description: 'Movilidad corporal', Icon: IconFlexibilidad },
  { value: 'energia', label: 'Energía', description: 'Más rendimiento', Icon: IconEnergia },
  { value: 'social', label: 'Social', description: 'Entrenar en comunidad', Icon: IconSocial },
]

export default function PerfilPageClient({ userId, initialProfile }: Props) {
  const inputFotoRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState<PerfilFormState>(initialProfile)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)

  const [modalPasswordAbierto, setModalPasswordAbierto] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [actualizandoPassword, setActualizandoPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordExito, setPasswordExito] = useState<string | null>(null)

  const hoyIso = new Date().toISOString().slice(0, 10)
  const inicialesUsuario = inicialesDesdeTexto(form.nombre || form.email || 'Muver')


  function actualizarCampo<K extends keyof PerfilFormState>(campo: K, valor: PerfilFormState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }
  function limpiarMensajes() {
    setMensajeExito(null)
    setMensajeError(null)
  }

  async function subirFotoPerfil(event: ChangeEvent<HTMLInputElement>) {
    limpiarMensajes()
    const archivo = event.target.files?.[0]
    if (!archivo) return

    if (!MIME_TYPES_PERMITIDOS.includes(archivo.type)) {
      setMensajeError('Formato no permitido. Usa JPG, PNG o WEBP.')
      event.target.value = ''
      return
    }
    if (archivo.size > MAX_FOTO_SIZE_BYTES) {
      setMensajeError('La imagen supera el límite de 2MB.')
      event.target.value = ''
      return
    }

    const extension = extensionDesdeArchivo(archivo)
    if (!extension) {
      setMensajeError('No se pudo identificar la extensión del archivo.')
      event.target.value = ''
      return
    }

    setSubiendoFoto(true)
    try {
      const supabase = createClient()
      const nombreBase = nombreBaseArchivoSeguro(archivo.name)
      const rutaArchivo = `${userId}/${Date.now()}-${nombreBase}.${extension}`
      const storage = supabase.storage.from('avatars')

      const { error: uploadError } = await storage.upload(rutaArchivo, archivo, {
        cacheControl: '3600',
        contentType: archivo.type,
        upsert: true,
      })
      if (uploadError) {
        setMensajeError(uploadError.message || 'No se pudo subir la imagen.')
        return
      }

      const { data: fotoPublica } = storage.getPublicUrl(rutaArchivo)
      const fotoUrl = fotoPublica.publicUrl

      const { error: updateError } = await supabase
        .from('users')
        .update({ foto_url: fotoUrl })
        .eq('id', userId)

      if (updateError) {
        setMensajeError(updateError.message || 'No se pudo guardar la foto de perfil.')
        return
      }

      actualizarCampo('foto_url', fotoUrl)
      setMensajeExito('Foto de perfil actualizada.')
    } catch {
      setMensajeError('Error de conexión al subir la imagen.')
    } finally {
      setSubiendoFoto(false)
      event.target.value = ''
    }
  }

  async function guardarCambios(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    limpiarMensajes()

    const nombre = form.nombre.trim()
    if (!nombre) {
      setMensajeError('El nombre completo es obligatorio.')
      return
    }

    setGuardando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          nombre,
          telefono: form.telefono.trim() || null,
          ciudad: form.ciudad,
          fecha_nacimiento: form.fecha_nacimiento || null,
          genero: form.genero || null,
          objetivo: form.objetivo || null,
          foto_url: form.foto_url || null,
        })
        .eq('id', userId)

      if (error) {
        setMensajeError(error.message || 'No se pudo guardar el perfil.')
        return
      }

      actualizarCampo('nombre', nombre)
      setMensajeExito('Cambios guardados correctamente.')
    } catch {
      setMensajeError('Error de conexión al guardar tu perfil.')
    } finally {
      setGuardando(false)
    }
  }

  async function actualizarPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordExito(null)

    if (nuevaPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setActualizandoPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
      if (error) {
        setPasswordError(error.message || 'No se pudo actualizar la contraseña.')
        return
      }

      setPasswordExito('Contraseña actualizada correctamente.')
      setNuevaPassword('')
      window.setTimeout(() => {
        setModalPasswordAbierto(false)
        setPasswordExito(null)
      }, 900)
    } catch {
      setPasswordError('Error de conexión al actualizar contraseña.')
    } finally {
      setActualizandoPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-24">
      <div className="bg-white px-4 py-6 shadow-sm">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
        >
          ← Regresar / Inicio
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Mi perfil</h1>
        <p className="mt-1 text-sm text-[#888]">
          Administra tus datos personales y preferencias fitness.
        </p>
      </div>

      <div className="mx-auto mt-4 w-full max-w-lg space-y-4 px-4">
        <form
          onSubmit={guardarCambios}
          className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm"
        >
          <div className="mb-6 flex flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#6B4FE8] text-2xl font-black text-white">
              {form.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <span>{inicialesUsuario}</span>
              )}
            </div>

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={subirFotoPerfil}
            />
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={subiendoFoto}
              className="mt-3 rounded-lg border border-[#6B4FE8] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {subiendoFoto ? 'Subiendo foto...' : 'Subir foto de perfil'}
            </button>
            <p className="mt-2 text-[11px] text-[#888]">Solo JPG, PNG o WEBP · máximo 2MB</p>
          </div>

          {mensajeError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {mensajeError}
            </div>
          )}
          {mensajeExito && (
            <div className="mb-4 rounded-lg border border-[#6B4FE8]/20 bg-[#6B4FE8]/10 px-3 py-2 text-sm text-[#4A2CA3]">
              {mensajeExito}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Nombre completo
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(event) => actualizarCampo('nombre', event.target.value)}
                required
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Correo electrónico
              </label>
              <input
                type="email"
                value={form.email}
                readOnly
                className="w-full cursor-not-allowed rounded-lg border border-[#E5E5E5] bg-[#F3F4F6] px-3 py-2.5 text-sm text-[#666] outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Teléfono
              </label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(event) => actualizarCampo('telefono', event.target.value)}
                placeholder="(000) 000 0000"
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Ciudad
              </label>
              <select
                value={form.ciudad}
                onChange={(event) => actualizarCampo('ciudad', event.target.value as Ciudad)}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              >
                {CIUDADES.map((ciudad) => (
                  <option key={ciudad} value={ciudad}>
                    {CIUDAD_LABELS[ciudad]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(event) => actualizarCampo('fecha_nacimiento', event.target.value)}
                max={hoyIso}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Género
              </label>
              <select
                value={form.genero}
                onChange={(event) => actualizarCampo('genero', event.target.value as GeneroPerfil | '')}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              >
                <option value="">Selecciona una opción</option>
                {GENERO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                Objetivo fitness
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {OBJETIVOS.map((objetivo) => {
                  const activa = form.objetivo === objetivo.value
                  const Icon = objetivo.Icon
                  return (
                    <button
                      key={objetivo.value}
                      type="button"
                      onClick={() => actualizarCampo('objetivo', activa ? '' : objetivo.value)}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        activa
                          ? 'border-[#6B4FE8] bg-[#F6F1FF]'
                          : 'border-[#E5E5E5] bg-white hover:border-[#6B4FE8]/50'
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                        activa ? 'bg-[#6B4FE8] text-white' : 'bg-[#EFEAFF] text-[#6B4FE8]'
                      }`}>
                        <Icon />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-[#0A0A0A]">{objetivo.label}</span>
                        <span className="block text-xs text-[#666]">{objetivo.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 rounded-lg bg-[#6B4FE8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => {
                setModalPasswordAbierto(true)
                setPasswordError(null)
                setPasswordExito(null)
              }}
              className="flex-1 rounded-lg border border-[#0A0A0A] bg-white py-3 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white"
            >
              Cambiar contraseña
            </button>
          </div>
        </form>
      </div>

      {modalPasswordAbierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[#E5E5E5] bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#0A0A0A]">
                Cambiar contraseña
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalPasswordAbierto(false)
                  setNuevaPassword('')
                  setPasswordError(null)
                  setPasswordExito(null)
                }}
                className="rounded-md border border-[#E5E5E5] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={actualizarPassword} className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={nuevaPassword}
                  onChange={(event) => setNuevaPassword(event.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                />
              </div>

              {passwordError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {passwordError}
                </p>
              )}
              {passwordExito && (
                <p className="rounded-md border border-[#6B4FE8]/20 bg-[#6B4FE8]/10 px-3 py-2 text-xs font-semibold text-[#4A2CA3]">
                  {passwordExito}
                </p>
              )}

              <button
                type="submit"
                disabled={actualizandoPassword}
                className="w-full rounded-lg bg-[#6B4FE8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actualizandoPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
