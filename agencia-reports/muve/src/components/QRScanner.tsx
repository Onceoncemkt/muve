'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (texto: string) => void
  activo: boolean
}

// ID estable para el elemento del DOM que html5-qrcode necesita
const SCANNER_ELEMENT_ID = 'muve-qr-scanner'

export default function QRScanner({ onScan, activo }: Props) {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)

  useEffect(() => {
    if (!activo) return

    let destruido = false

    async function iniciarEscaner() {
      setIniciando(true)
      setError(null)

      try {
        // Importación dinámica para evitar SSR — html5-qrcode accede a window/document
        const { Html5Qrcode } = await import('html5-qrcode')

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (texto) => {
            if (!destruido) onScan(texto)
          },
          // Errores de frame (QR no encontrado aún) — ignorar
          () => {}
        )
      } catch (err) {
        if (!destruido) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
            setError('Permiso de cámara denegado. Actívalo en los ajustes del navegador.')
          } else {
            setError('No se pudo iniciar la cámara.')
          }
        }
      } finally {
        if (!destruido) setIniciando(false)
      }
    }

    iniciarEscaner()

    return () => {
      destruido = true
      const scanner = scannerRef.current
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          scanner.clear()
          scannerRef.current = null
        })
      }
    }
  }, [activo, onScan])

  if (!activo) return null

  return (
    <div className="flex flex-col items-center gap-3">
      {iniciando && (
        <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-gray-100">
          <p className="text-sm text-gray-400">Iniciando cámara...</p>
        </div>
      )}

      {error && (
        <div className="w-full rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* html5-qrcode monta el video aquí directamente */}
      <div
        id={SCANNER_ELEMENT_ID}
        className="w-full overflow-hidden rounded-2xl [&_video]:w-full [&_video]:rounded-2xl"
      />

      <p className="text-xs text-gray-400">
        Apunta la cámara al QR del usuario
      </p>
    </div>
  )
}
