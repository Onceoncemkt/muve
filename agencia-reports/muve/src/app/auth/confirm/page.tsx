'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const TIPOS_OTP_PERMITIDOS = ['invite', 'recovery', 'magiclink', 'signup', 'email_change'] as const

function tipoOtpDesdeQuery(type: string | null): EmailOtpType | null {
  if (!type) return null
  const normalizado = type.trim().toLowerCase()
  if (!TIPOS_OTP_PERMITIDOS.includes(normalizado as (typeof TIPOS_OTP_PERMITIDOS)[number])) {
    return null
  }
  return normalizado as EmailOtpType
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A]" />}>
      <ConfirmPageContent />
    </Suspense>
  )
}

function ConfirmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sesionValida, setSesionValida] = useState(false)
  const [cargando, setCargando] = useState(false)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')
  const tipoOtp = useMemo(() => tipoOtpDesdeQuery(type), [type])
  const tieneCredencialesEnUrl = Boolean(code) || (Boolean(tokenHash) && Boolean(tipoOtp))
  const puedeActivar = sesionValida || tieneCredencialesEnUrl

  useEffect(() => {
    let activo = true

    async function hidratarSesionDesdeHash() {
      const supabase = createClient()
      const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (typeof window !== 'undefined') {
          const nuevaUrl = `${window.location.pathname}${window.location.search}`
          window.history.replaceState({}, '', nuevaUrl)
        }
      }

      const { data: authData } = await supabase.auth.getUser()
      if (activo && authData.user) {
        setSesionValida(true)
      }
    }

    void hidratarSesionDesdeHash()
    return () => {
      activo = false
    }
  }, [])

  async function asegurarSesionDesdeLink() {
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    if (authData.user) return { supabase, error: null as string | null }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      return { supabase, error: error?.message ?? null }
    }

    if (tokenHash && tipoOtp) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tipoOtp,
      })
      return { supabase, error: error?.message ?? null }
    }

    return { supabase, error: 'El enlace de activación no es válido o está incompleto.' }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!puedeActivar) {
      setError('El enlace de activación no es válido o está incompleto.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    try {
      const { supabase, error: sessionError } = await asegurarSesionDesdeLink()
      if (sessionError) {
        setError('No se pudo validar el enlace de invitación. Solicita uno nuevo.')
        return
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) {
        setError(passwordError.message)
        return
      }

      await supabase.auth.signOut()
      router.replace('/login?activada=1')
      router.refresh()
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
          className="text-xs font-bold uppercase tracking-widest text-white/30 transition-colors hover:text-white/60"
        >
          MUVET
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Crea tu
              <br />
              contraseña.
            </h1>
            <p className="mt-3 text-sm text-white/40">
              Activa tu cuenta para poder iniciar sesión.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!puedeActivar && (
              <div className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                El enlace de activación no es válido o está incompleto.
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                Crea tu contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
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
                onChange={event => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/30"
              />
            </div>

            <button
              type="submit"
              disabled={cargando || !puedeActivar}
              className="mt-1 w-full rounded-lg bg-[#E8FF47] py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white disabled:opacity-40"
            >
              {cargando ? 'Activando...' : 'Activar mi cuenta'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-white/30">
            <Link href="/login" className="font-semibold text-white transition-colors hover:text-[#E8FF47]">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
