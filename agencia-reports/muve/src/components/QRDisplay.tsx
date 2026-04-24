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
  const [qrData, setQrData]      = useState<QRData | null>(null)
  const [qrImage, setQrImage]    = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
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
        setError(`No se pudo generar tu QR. Intenta de nuevo.`)
        return
      }

      const data: QRData = await res.json()
      setQrData(data)

      const imagen = await QRCode.toDataURL(data.token, {
        width: 300,
        margin: 2,
        color: { dark: '#0A0A0A', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      setQrImage(imagen)
    } catch (err) {
      console.error('[QRDisplay] error:', err)
      setError('Error de conexión. Verifica tu red e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarQR() }, [cargarQR])

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

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="h-[300px] w-[300px] animate-pulse rounded-lg bg-[#F0F0F0]" />
        <div className="h-4 w-32 animate-pulse rounded bg-[#F0F0F0]" />
        <p className="text-xs text-[#888]">Generando tu QR del día...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="font-bold text-red-700">{error}</p>
        <button
          onClick={cargarQR}
          className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* QR image */}
      <div className="rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrImage!} alt="Tu QR MUVET" width={300} height={300} className="block" />
      </div>

      {/* Cuenta regresiva */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#888]">
          Válido hoy — expira en
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums text-[#6B4FE8]">
          {countdown}
        </p>
      </div>

      <p className="max-w-xs text-center text-xs text-[#888]">
        Muestra este código al staff del negocio. Se genera uno nuevo cada 24 horas.
      </p>
    </div>
  )
}
