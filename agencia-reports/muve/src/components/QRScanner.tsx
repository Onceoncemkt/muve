'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (texto: string) => void
  activo: boolean
}

const SCANNER_ELEMENT_ID = 'muvet-qr-scanner'

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
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (texto) => { if (!destruido) onScan(texto) },
          () => {}
        )
      } catch (err) {
        if (!destruido) {
          const msg = err instanceof Error ? err.message : String(err)
          setError(
            msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')
              ? 'Permiso de cámara denegado. Actívalo en los ajustes del navegador.'
              : 'No se pudo iniciar la cámara.'
          )
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
        <div className="flex h-64 w-full items-center justify-center rounded-lg bg-[#F7F7F7]">
          <p className="text-sm text-[#888]">Iniciando cámara...</p>
        </div>
      )}

      {error && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        id={SCANNER_ELEMENT_ID}
        className="w-full overflow-hidden rounded-lg [&_video]:w-full [&_video]:rounded-lg"
      />

      <p className="text-xs text-[#888]">
        Apunta la cámara al QR del usuario
      </p>
    </div>
  )
}
