'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type FormData = {
  categoria: string
  nombre: string
  ciudad: string
  direccion: string
  instagram: string
  tiktok: string
  contacto_nombre: string
  contacto_email: string
  contacto_telefono: string
  clientes_mes: string
  tiene_reservas: boolean | null
  tiene_cuenta_bancaria: boolean | null
  horario: string
}

const TOTAL_PASOS = 5
const CATEGORIAS = ['GYM', 'Clases boutique', 'Estéticas y Spa', 'Restaurante', 'Clínica', 'Otro']
const CIUDADES = ['Tulancingo', 'Pachuca', 'Ensenada', 'Tijuana', 'Otra']
const CLIENTES_MES = ['Menos de 50', '50-100', '100-300', 'Más de 300']

const FORMULARIO_INICIAL: FormData = {
  categoria: '',
  nombre: '',
  ciudad: 'Tulancingo',
  direccion: '',
  instagram: '',
  tiktok: '',
  contacto_nombre: '',
  contacto_email: '',
  contacto_telefono: '',
  clientes_mes: 'Menos de 50',
  tiene_reservas: null,
  tiene_cuenta_bancaria: null,
  horario: '',
}

function limpiarHandle(value: string) {
  return value.trim().replace(/^@+/, '')
}

export default function RegistroNegociosPage() {
  const [paso, setPaso] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState<FormData>(FORMULARIO_INICIAL)

  const progreso = useMemo(() => {
    if (paso <= 1) return 0
    return ((paso - 1) / (TOTAL_PASOS - 1)) * 100
  }, [paso])

  function validarPasoActual() {
    setError(null)

    if (paso === 1 && !form.categoria) {
      setError('Selecciona el tipo de negocio para continuar.')
      return false
    }

    if (paso === 2) {
      if (!form.nombre.trim()) {
        setError('El nombre del negocio es requerido.')
        return false
      }
      if (form.instagram.includes('@') || form.tiktok.includes('@')) {
        setError('Instagram y TikTok deben escribirse sin @.')
        return false
      }
    }

    if (paso === 3) {
      if (!form.contacto_nombre.trim()) {
        setError('El nombre de contacto es requerido.')
        return false
      }
      if (!form.contacto_email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contacto_email)) {
        setError('Ingresa un email válido.')
        return false
      }
      if (!form.contacto_telefono.trim()) {
        setError('El teléfono es requerido.')
        return false
      }
    }

    if (paso === 4) {
      if (form.tiene_reservas === null || form.tiene_cuenta_bancaria === null) {
        setError('Responde las preguntas de operación para continuar.')
        return false
      }
    }

    return true
  }

  async function avanzar() {
    if (!validarPasoActual()) return

    if (paso < 4) {
      setPaso((prev) => prev + 1)
      return
    }

    setEnviando(true)
    setError(null)

    try {
      const response = await fetch('/api/negocios/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          instagram: limpiarHandle(form.instagram),
          tiktok: limpiarHandle(form.tiktok),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload?.error ?? 'No se pudo completar el registro. Intenta de nuevo.')
        return
      }

      setPaso(5)
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  function retroceder() {
    setError(null)
    setPaso((prev) => Math.max(1, prev - 1))
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
        <header className="mb-10">
          <Link href="/" className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white">
            MUVET
          </Link>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/50">
              <span>Paso {paso} de {TOTAL_PASOS}</span>
              <span>{Math.round(progreso)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#E8FF47] transition-[width] duration-300 ease-out"
                style={{ width: `${progreso}%` }}
                aria-hidden
              />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div key={paso} className="wizard-step-enter flex flex-1 flex-col">
            {paso === 1 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-black leading-tight text-white md:text-3xl">
                  ¿Qué tipo de negocio tienes?
                </h1>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {CATEGORIAS.map((categoria) => (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, categoria }))}
                      className={`rounded-xl border px-4 py-4 text-left text-sm font-bold transition-colors ${
                        form.categoria === categoria
                          ? 'border-[#E8FF47] bg-[#E8FF47]/10 text-[#E8FF47]'
                          : 'border-white/10 bg-black/20 text-white/80 hover:border-white/30'
                      }`}
                    >
                      {categoria}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paso === 2 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-black leading-tight text-white md:text-3xl">
                  Cuéntanos sobre tu negocio
                </h1>
                <div className="mt-6 space-y-4">
                  <Campo
                    label="Nombre del negocio *"
                    value={form.nombre}
                    onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))}
                    placeholder="Ej. MUVET Fitness Studio"
                    required
                  />
                  <CampoSelect
                    label="Ciudad"
                    value={form.ciudad}
                    onChange={(value) => setForm((prev) => ({ ...prev, ciudad: value }))}
                    options={CIUDADES}
                  />
                  <Campo
                    label="Dirección"
                    value={form.direccion}
                    onChange={(value) => setForm((prev) => ({ ...prev, direccion: value }))}
                    placeholder="Calle y número"
                  />
                  <Campo
                    label="Instagram (sin @)"
                    value={form.instagram}
                    onChange={(value) => setForm((prev) => ({ ...prev, instagram: limpiarHandle(value) }))}
                    placeholder="muvet.mx"
                  />
                  <Campo
                    label="TikTok (sin @)"
                    value={form.tiktok}
                    onChange={(value) => setForm((prev) => ({ ...prev, tiktok: limpiarHandle(value) }))}
                    placeholder="muvet.mx"
                  />
                </div>
              </div>
            )}

            {paso === 3 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-black leading-tight text-white md:text-3xl">
                  ¿A quién contactamos?
                </h1>
                <div className="mt-6 space-y-4">
                  <Campo
                    label="Nombre completo del dueño/encargado *"
                    value={form.contacto_nombre}
                    onChange={(value) => setForm((prev) => ({ ...prev, contacto_nombre: value }))}
                    placeholder="Nombre y apellidos"
                    required
                  />
                  <Campo
                    label="Email *"
                    type="email"
                    value={form.contacto_email}
                    onChange={(value) => setForm((prev) => ({ ...prev, contacto_email: value }))}
                    placeholder="correo@negocio.com"
                    required
                  />
                  <Campo
                    label="Teléfono *"
                    type="tel"
                    value={form.contacto_telefono}
                    onChange={(value) => setForm((prev) => ({ ...prev, contacto_telefono: value }))}
                    placeholder="7710000000"
                    required
                  />
                </div>
              </div>
            )}

            {paso === 4 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-2xl font-black leading-tight text-white md:text-3xl">
                  ¿Cómo opera tu negocio hoy?
                </h1>
                <div className="mt-6 space-y-4">
                  <CampoSelect
                    label="¿Cuántos clientes atiendes al mes?"
                    value={form.clientes_mes}
                    onChange={(value) => setForm((prev) => ({ ...prev, clientes_mes: value }))}
                    options={CLIENTES_MES}
                  />
                  <SelectorBooleano
                    label="¿Tienes sistema de reservas actualmente?"
                    value={form.tiene_reservas}
                    onChange={(value) => setForm((prev) => ({ ...prev, tiene_reservas: value }))}
                  />
                  <SelectorBooleano
                    label="¿Tienes cuenta bancaria para recibir depósitos?"
                    value={form.tiene_cuenta_bancaria}
                    onChange={(value) => setForm((prev) => ({ ...prev, tiene_cuenta_bancaria: value }))}
                  />
                  <Campo
                    label="Horario de atención"
                    value={form.horario}
                    onChange={(value) => setForm((prev) => ({ ...prev, horario: value }))}
                    placeholder='Ej. "Lunes a Viernes 6am-10pm"'
                  />
                </div>
              </div>
            )}

            {paso === 5 && (
              <div className="flex flex-1 flex-col items-start justify-center">
                <h1 className="text-3xl font-black text-[#E8FF47]">Registro enviado</h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80">
                  Gracias, {form.contacto_nombre}. Recibimos tu información. Nuestro equipo te contactará en menos de 48 horas.
                </p>
                <Link
                  href="/"
                  className="mt-8 inline-flex rounded-lg bg-[#E8FF47] px-6 py-3 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white"
                >
                  Volver al inicio
                </Link>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
              {error}
            </p>
          )}

          {paso < 5 && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={retroceder}
                disabled={paso === 1 || enviando}
                className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={avanzar}
                disabled={enviando}
                className="rounded-lg bg-[#6B4FE8] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#7c64ea] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {paso === 4 ? (enviando ? 'Enviando...' : 'Enviar registro') : 'Siguiente'}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: 'text' | 'email' | 'tel'
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#6B4FE8] focus:ring-2 focus:ring-[#6B4FE8]/30"
      />
    </div>
  )
}

function CampoSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#6B4FE8] focus:ring-2 focus:ring-[#6B4FE8]/30"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#0A0A0A] text-white">
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function SelectorBooleano({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-lg border px-4 py-3 text-sm font-bold transition-colors ${
            value === true
              ? 'border-[#E8FF47] bg-[#E8FF47]/10 text-[#E8FF47]'
              : 'border-white/15 bg-black/20 text-white/80 hover:border-white/30'
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-lg border px-4 py-3 text-sm font-bold transition-colors ${
            value === false
              ? 'border-[#E8FF47] bg-[#E8FF47]/10 text-[#E8FF47]'
              : 'border-white/15 bg-black/20 text-white/80 hover:border-white/30'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}
