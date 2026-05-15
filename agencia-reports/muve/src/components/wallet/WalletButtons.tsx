'use client'

import { useState, useSyncExternalStore } from 'react'

type Props = {
  userId: string
}

type WalletResponse = {
  walletUrl?: string
  error?: string
}

type Plataforma = 'ios' | 'android' | 'desktop'

function detectarPlataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const platform =
    'userAgentData' in navigator && navigator.userAgentData
      ? (navigator.userAgentData as { platform?: string }).platform ?? ''
      : ''
  const isIPad =
    /iPad/i.test(ua)
    || (platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
  if (/iPhone|iPod/i.test(ua) || isIPad) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

function suscribirPlataforma() {
  return () => {}
}

export default function WalletButtons({ userId }: Props) {
  const plataforma = useSyncExternalStore<Plataforma>(
    suscribirPlataforma,
    detectarPlataforma,
    () => 'desktop',
  )
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingApple, setLoadingApple] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleWallet() {
    setLoadingGoogle(true)
    setError(null)
    try {
      const response = await fetch('/api/wallet/google/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await response.json().catch(() => ({})) as WalletResponse
      if (!response.ok) {
        setError(data.error ?? 'No se pudo generar el pase de Google Wallet.')
        return
      }
      if (!data.walletUrl || typeof data.walletUrl !== 'string') {
        setError('La respuesta no incluyó una URL válida de Wallet.')
        return
      }
      window.location.href = data.walletUrl
    } catch {
      setError('Error de conexión al agregar a Google Wallet.')
    } finally {
      setLoadingGoogle(false)
    }
  }

  async function handleAppleWallet() {
    setLoadingApple(true)
    setError(null)
    try {
      const response = await fetch(`/api/wallet/apple/${userId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as WalletResponse
        setError(data.error ?? 'No se pudo generar el pase de Apple Wallet.')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      setError('Error de conexión al agregar a Apple Wallet.')
    } finally {
      setLoadingApple(false)
    }
  }

  const mostrarApple = plataforma === 'ios' || plataforma === 'desktop'
  const mostrarGoogle = plataforma === 'android' || plataforma === 'desktop'

  return (
    <div className="flex flex-col gap-3 w-full">
      {mostrarApple && (
        <button
          type="button"
          disabled={loadingApple}
          onClick={() => void handleAppleWallet()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-6 py-4 text-white transition-all hover:bg-[#1A1A1A] disabled:opacity-60"
          aria-label="Agregar a Apple Wallet"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">Add to</span>
            <span className="text-base font-semibold">Apple Wallet</span>
          </div>
          {loadingApple && <span className="ml-auto text-xs text-white/60">Generando…</span>}
        </button>
      )}

      {mostrarGoogle && (
        <button
          type="button"
          disabled={loadingGoogle}
          onClick={() => void handleGoogleWallet()}
          className="flex w-full items-center justify-center rounded-2xl bg-[#1F1F1F] px-6 py-4 transition-all hover:bg-[#2A2A2A] disabled:opacity-60"
          aria-label="Agregar a Google Wallet"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wallet/add-to-google-wallet-badge.svg"
            alt="Add to Google Wallet"
            style={{ height: '32px', width: 'auto' }}
          />
          {loadingGoogle && <span className="ml-3 text-xs text-white/60">Generando…</span>}
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
