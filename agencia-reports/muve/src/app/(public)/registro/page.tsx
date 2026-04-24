'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Ciudad } from '@/types'
import { CIUDAD_LABELS } from '@/types'

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']

export default function RegistroPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ciudad, setCiudad] = useState<Ciudad>('tulancingo')
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
        options: {
          data: { nombre, ciudad },
        },
      })

      if (error) {
        setError(error.message)
        setCargando(false)
        return
      }

      if (data.session) {
        // Sin confirmación de email: sesión creada, redirigir directo
        window.location.href = '/dashboard'
      } else {
        // Confirmación de email requerida: mostrar instrucción
        setCargando(false)
        setEsperandoConfirmacion(true)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  // Estado: esperando confirmación de email
  if (esperandoConfirmacion) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950">
        <div className="px-6 pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← MUVE
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/20 text-3xl">
                📬
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Revisa tu correo
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Te enviamos un enlace de confirmación a{' '}
              <span className="font-semibold text-white">{email}</span>.
              <br />
              Haz clic en el enlace para activar tu cuenta e iniciar sesión.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block w-full rounded-xl bg-indigo-600 py-4 text-sm font-bold tracking-wide text-white transition-colors hover:bg-indigo-500"
            >
              Ir a iniciar sesión
            </Link>
            <p className="mt-4 text-xs text-zinc-600">
              ¿No te llegó? Revisa tu carpeta de spam.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Back link */}
      <div className="px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← MUVE
        </Link>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Empieza a<br />moverte hoy.
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Crea tu cuenta y accede a gimnasios, clases y más.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl border border-red-800/50 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Nombre completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                autoComplete="name"
                placeholder="Ana García"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
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
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            {/* Ciudad — botones en lugar de select */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Tu ciudad
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CIUDADES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCiudad(c)}
                    className={`rounded-xl border py-3 text-xs font-bold tracking-wide transition-colors ${
                      ciudad === c
                        ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
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
              className="mt-1 w-full rounded-xl bg-indigo-600 py-4 text-sm font-bold tracking-wide text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40"
            >
              {cargando ? 'Creando cuenta...' : 'Crear cuenta →'}
            </button>

            <p className="text-center text-xs text-zinc-600">
              Al registrarte aceptas nuestros términos de servicio.
            </p>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-zinc-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
