'use client'

import { useEffect, useState, useCallback } from 'react'
import QRCode from 'qrcode'

interface QRData {
  token: string
  fecha_expiracion: string
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expirado'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export default function QRDisplay() {
  const [qrData, setQrData]     = useState<QRData | null>(null)
  const [qrImage, setQrImage]   = useState<string | null>(null)
  const [error, setError]        = useState<string | null>(null)
  const [loading, setLoading]    = useState(true)
  const [countdown, setCountdown] = useState('')

  const cargarQR = useCallback(async () => {
    setLoading(true)
    setError(null)
    setQrData(null)
    setQrImage(null)

    try {
      const res = await fetch('/api/qr')

      if (res.status === 401) {
        setError('Tu sesión expiró. Recarga la página para continuar.')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[QRDisplay] API error:', res.status, body)
        setError(`No se pudo generar tu QR (${res.status}). Intenta de nuevo.`)
        return
      }

      const data: QRData = await res.json()
      setQrData(data)

      const imagen = await QRCode.toDataURL(data.token, {
        width: 300,
        margin: 2,
        color: { dark: '#1e1b4b', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      setQrImage(imagen)
    } catch (err) {
      console.error('[QRDisplay] unexpected error:', err)
      setError('Error de conexión. Verifica tu red e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarQR() }, [cargarQR])

  // Cuenta regresiva
  useEffect(() => {
    if (!qrData) return
    const tick = () => {
      const diff = new Date(qrData.fecha_expiracion).getTime() - Date.now()
      setCountdown(formatCountdown(diff))
      if (diff <= 0) clearInterval(id)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [qrData])

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="h-[300px] w-[300px] animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-4 w-32 animate-pulse rounded-full bg-gray-100" />
        <p className="text-sm text-gray-400">Generando tu QR del día...</p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-red-50 px-6 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
          ⚠️
        </div>
        <p className="font-medium text-red-700">{error}</p>
        <button
          onClick={cargarQR}
          className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // ── QR ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Imagen QR */}
      <div className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImage!}
          alt="Tu código QR MUVE"
          width={300}
          height={300}
          className="block"
        />
      </div>

      {/* Cuenta regresiva */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Válido hoy · expira en
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums text-indigo-600">
          {countdown}
        </p>
      </div>

      {/* Instrucción */}
      <p className="max-w-xs text-center text-xs text-gray-400">
        Muestra este código al staff del negocio para registrar tu entrada.
        Se genera un código nuevo cada 24 horas.
      </p>
    </div>
  )
}
