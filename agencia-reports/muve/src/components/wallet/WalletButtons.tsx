'use client'

import { useState } from 'react'

type Props = {
  userId: string
}

type WalletResponse = {
  walletUrl?: string
  error?: string
}

function esMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
}

export default function WalletButtons({ userId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleWallet() {
    setLoading(true)
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

      if (esMobile()) {
        window.location.href = data.walletUrl
      } else {
        const popup = window.open(data.walletUrl, '_blank', 'noopener,noreferrer')
        if (!popup) {
          window.location.href = data.walletUrl
        }
      }
    } catch {
      setError('Error de conexión al agregar a Google Wallet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleGoogleWallet()}
        className="flex w-full items-center justify-center rounded-2xl bg-[#1F1F1F] px-6 py-4 transition-all hover:bg-[#2A2A2A]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wallet/add-to-google-wallet-badge.svg"
          alt="Add to Google Wallet"
          style={{ height: '32px', width: 'auto' }}
        />
      </button>

      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-6 py-4 opacity-60 cursor-not-allowed transition-all"
        aria-label="Apple Wallet próximamente disponible"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-white">Apple Wallet</span>
          <span className="text-xs text-[#888]">Próximamente</span>
        </div>
      </button>

      {loading && <p className="text-xs font-semibold text-[#666]">Generando pase...</p>}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
