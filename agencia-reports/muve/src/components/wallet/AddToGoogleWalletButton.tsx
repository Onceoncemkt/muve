'use client'

import { useState } from 'react'

type Props = {
  userId: string
}

type AddWalletResponse = {
  walletUrl?: string
  error?: string
}

export default function AddToGoogleWalletButton({ userId }: Props) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function agregarPaseGoogle() {
    setError(null)
    setCargando(true)

    try {
      const response = await fetch('/api/wallet/google/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ userId }),
      })
      const data = await response.json().catch(() => ({})) as AddWalletResponse

      if (!response.ok) {
        setError(data.error ?? 'No se pudo generar tu pase de Google Wallet.')
        return
      }

      if (!data.walletUrl || typeof data.walletUrl !== 'string') {
        setError('La respuesta no incluyó una URL válida para Wallet.')
        return
      }

      const opened = window.open(data.walletUrl, '_blank', 'noopener,noreferrer')
      if (!opened) {
        window.location.assign(data.walletUrl)
      }
    } catch {
      setError('Error de conexión al agregar el pase.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void agregarPaseGoogle()}
        disabled={cargando}
        className="inline-flex rounded-xl border border-[#E5E5E5] bg-white p-0.5 transition-colors hover:border-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://developers.google.com/wallet/generic/resources/images/add-to-google-wallet-add-wallet-badge.png"
          alt="Agregar a Google Wallet"
          className="h-12 w-auto"
        />
      </button>

      {cargando && <p className="text-xs font-semibold text-[#666]">Abriendo Google Wallet...</p>}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
