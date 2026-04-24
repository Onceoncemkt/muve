'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError('Correo o contraseña incorrectos')
        setCargando(false)
        return
      }
      if (!data.user?.id) {
        setError('No se pudo iniciar sesión. Intenta de nuevo.')
        setCargando(false)
        return
      }
      const rolResponse = await fetch('/api/auth/rol', {
        method: 'GET',
        cache: 'no-store',
credentials: 'include',
      })
      const rolData = rolResponse.ok
        ? await rolResponse.json() as { rol?: 'admin' | 'staff' | 'usuario' }
        : null
      const rol = rolData?.rol

      if (rol === 'admin') {
        window.location.href = '/admin'
      } else if (rol === 'staff') {
        window.location.href = '/negocio/dashboard'
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
      <div className="px-6 pt-8">
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
        >
          MUVET
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Bienvenido<br />de vuelta.
            </h1>
            <p className="mt-3 text-sm text-white/40">
              Inicia sesión para acceder a tu membresía.
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
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/30"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="mt-1 w-full rounded-lg bg-[#E8FF47] py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white disabled:opacity-40"
            >
              {cargando ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-white/30">
            Sin cuenta?{' '}
            <Link href="/registro" className="font-semibold text-white hover:text-[#E8FF47] transition-colors">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
