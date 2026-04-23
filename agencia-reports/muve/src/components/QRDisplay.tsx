'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRData {
  token: string
  fecha_expiracion: string
}

export default function QRDisplay() {
  const [qrData, setQRData] = useState<QRData | null>(null)
  const [qrImage, setQRImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tiempoRestante, setTiempoRestante] = useState('')

  useEffect(() => {
    async function obtenerQR() {
      try {
        const res = await fetch('/api/qr')
        if (!res.ok) throw new Error('Error al obtener QR')
        const data: QRData = await res.json()
        setQRData(data)

        const imagen = await QRCode.toDataURL(data.token, {
          width: 280,
          margin: 2,
          color: { dark: '#1a1a2e', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        })
        setQRImage(imagen)
      } catch {
        setError('No se pudo cargar tu QR. Intenta de nuevo.')
      }
    }
    obtenerQR()
  }, [])

  // Cuenta regresiva hasta expiración
  useEffect(() => {
    if (!qrData) return
    const intervalo = setInterval(() => {
      const diff = new Date(qrData.fecha_expiracion).getTime() - Date.now()
      if (diff <= 0) {
        setTiempoRestante('Expirado')
        clearInterval(intervalo)
        return
      }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTiempoRestante(`${h}h ${m}m ${s}s`)
    }, 1000)
    return () => clearInterval(intervalo)
  }, [qrData])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-red-50 p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!qrImage) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-[280px] w-[280px] animate-pulse rounded-2xl bg-gray-200" />
        <p className="text-sm text-gray-400">Generando tu QR del día...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrImage} alt="Tu QR MUVE" width={280} height={280} />
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-gray-500">Válido hoy — expira en</p>
        <p className="font-mono text-lg font-semibold text-indigo-600">{tiempoRestante}</p>
      </div>

      <p className="max-w-xs text-center text-xs text-gray-400">
        Muestra este código al staff del negocio para registrar tu visita.
        Se genera uno nuevo cada día.
      </p>
    </div>
  )
}
