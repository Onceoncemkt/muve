'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setCargando(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
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
              Bienvenido<br />de vuelta.
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Inicia sesión para acceder a tu membresía.
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
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="mt-1 w-full rounded-xl bg-indigo-600 py-4 text-sm font-bold tracking-wide text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40"
            >
              {cargando ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-zinc-600">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
