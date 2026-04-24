'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Ciudad } from '@/types'
import { CIUDAD_LABELS } from '@/types'

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
async function enviarEmailBienvenida(payload: { email: string; nombre: string }) {
  try {
    const response = await fetch('/api/email/bienvenida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      console.warn('[registro] No se pudo enviar email de bienvenida:', errorPayload)
    }
  } catch (error) {
    console.warn('[registro] Error enviando email de bienvenida:', error)
  }
}

export default function RegistroPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<Ciudad>('tulancingo')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [esperandoConfirmacion, setEsperandoConfirmacion] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setCargando(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, ciudad: ciudadSeleccionada } },
      })

      if (error) {
        setError(error.message)
        setCargando(false)
        return
      }
      const emailRegistro = data.user?.email ?? email
      if (emailRegistro) {
        await enviarEmailBienvenida({ email: emailRegistro, nombre })
      }

      if (data.session) {
        window.location.href = '/dashboard'
      } else {
        setCargando(false)
        setEsperandoConfirmacion(true)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  if (esperandoConfirmacion) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
        <div className="px-6 pt-8">
          <Link href="/" className="text-xs font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
            MUVET
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Revisa tu correo
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Enviamos un enlace de confirmación a{' '}
              <span className="font-semibold text-white">{email}</span>.
              Haz clic en el enlace para activar tu cuenta.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block w-full rounded-lg bg-[#E8FF47] py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white"
            >
              Ir a iniciar sesión
            </Link>
            <p className="mt-4 text-xs text-white/20">
              No te llegó? Revisa tu carpeta de spam.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
      <div className="px-6 pt-8">
        <Link href="/" className="text-xs font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
          MUVET
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Empieza a<br />moverte hoy.
            </h1>
            <p className="mt-3 text-sm text-white/40">
              Crea tu cuenta y accede a gimnasios, clases y más.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Nombre completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                autoComplete="name"
                placeholder="Ana García"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Tu ciudad
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CIUDADES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCiudadSeleccionada(c)}
                    className={`rounded-lg border py-3 text-xs font-bold tracking-wide transition-colors ${
                      ciudadSeleccionada === c
                        ? 'border-[#E8FF47] bg-[#E8FF47]/10 text-[#E8FF47]'
                        : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/60'
                    }`}
                  >
                    {CIUDAD_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="mt-1 w-full rounded-lg bg-[#E8FF47] py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white disabled:opacity-40"
            >
              {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

            <p className="text-center text-xs text-white/20">
              Al registrarte aceptas nuestros términos de servicio.
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-white/30">
            Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-white hover:text-[#E8FF47] transition-colors">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
