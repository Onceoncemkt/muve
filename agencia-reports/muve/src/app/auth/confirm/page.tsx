'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type TipoFlujo = 'invite' | 'signup' | 'recovery'

function normalizarTipo(value: string | null): TipoFlujo | null {
  if (!value) return null
  const tipo = value.trim().toLowerCase()
  if (tipo === 'invite' || tipo === 'signup' || tipo === 'recovery') {
    return tipo
  }
  return null
}

function tituloPorTipo(tipo: TipoFlujo | null) {
  if (tipo === 'recovery') return 'Nueva contraseña'
  return 'Crea tu contraseña'
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
  const [cargando, setCargando] = useState(false)
  const [inicializando, setInicializando] = useState(true)
  const [tipoFlujo, setTipoFlujo] = useState<TipoFlujo | null>(null)
  const [tokenValido, setTokenValido] = useState(false)

  useEffect(() => {
    let activo = true

    async function prepararSesion() {
      const supabase = createClient()
      setInicializando(true)
      setError(null)

      const tokenHash = searchParams.get('token_hash')
      const typeQueryRaw = searchParams.get('type')
      const tipoQuery = normalizarTipo(typeQueryRaw)
      let flujoDetectado: TipoFlujo | null = null

      try {
        if (tokenHash && tipoQuery) {
          flujoDetectado = tipoQuery
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: tipoQuery as EmailOtpType,
          })
        } else {
          const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
          const hashParams = new URLSearchParams(hash)
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          const tipoHash = normalizarTipo(hashParams.get('type'))

          if (accessToken && refreshToken && tipoHash) {
            flujoDetectado = tipoHash
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (typeof window !== 'undefined') {
              const limpia = `${window.location.pathname}${window.location.search}`
              window.history.replaceState({}, '', limpia)
            }
          }
        }

        const { data: authData } = await supabase.auth.getUser()
        if (!activo) return

        const sesionActiva = Boolean(authData.user)
        const tipoPermitido = flujoDetectado === 'invite' || flujoDetectado === 'signup' || flujoDetectado === 'recovery'
        const valido = sesionActiva && tipoPermitido
        setTipoFlujo(flujoDetectado)
        setTokenValido(valido)

        if (!valido) {
          setError('Link inválido o expirado')
        }
      } finally {
        if (activo) setInicializando(false)
      }
    }

    void prepararSesion()
    return () => {
      activo = false
    }
  }, [searchParams])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!tokenValido) {
      setError('Link inválido o expirado')
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
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
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

  const mostrarFormulario = tokenValido && Boolean(tipoFlujo)
  const titulo = tituloPorTipo(tipoFlujo)
  const subtitulo = tipoFlujo === 'recovery'
    ? 'Actualiza tu contraseña para recuperar el acceso.'
    : 'Activa tu cuenta para poder iniciar sesión.'

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
              {titulo}
            </h1>
            <p className="mt-3 text-sm text-white/40">{subtitulo}</p>
          </div>

          {inicializando ? (
            <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
              Validando enlace...
            </p>
          ) : !mostrarFormulario ? (
            <div className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              Link inválido o expirado
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/30">
                  {tipoFlujo === 'recovery' ? 'Nueva contraseña' : 'Crea tu contraseña'}
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
                disabled={cargando || !tokenValido}
                className="mt-1 w-full rounded-lg bg-[#E8FF47] py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white disabled:opacity-40"
              >
                {cargando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}

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
