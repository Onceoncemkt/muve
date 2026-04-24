'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess('Tu contraseña se actualizó correctamente.')
      setPassword('')
      setConfirmPassword('')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
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
              Nueva<br />contraseña.
            </h1>
            <p className="mt-3 text-sm text-white/40">
              Define una contraseña nueva para tu cuenta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Nueva contraseña
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

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repite tu nueva contraseña"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/30"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="mt-1 w-full rounded-lg bg-[#E8FF47] py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white disabled:opacity-40"
            >
              {cargando ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-white/30">
            <Link href="/login" className="font-semibold text-white hover:text-[#E8FF47] transition-colors">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
