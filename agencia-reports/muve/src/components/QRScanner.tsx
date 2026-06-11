'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (texto: string) => void
  activo: boolean
}

const SCANNER_ELEMENT_ID = 'muvet-qr-scanner'
const ERROR_CAMARA = 'No se pudo acceder a la cámara. Verifica los permisos en tu navegador.'

export default function QRScanner({ onScan, activo }: Props) {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null)
  const onScanRef = useRef(onScan)
  const scanProcesadoRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!activo) return

    let destruido = false
    async function detenerEscaner() {
      const scanner = scannerRef.current
      scannerRef.current = null
      if (!scanner) return

      try {
        await scanner.stop()
      } catch {}

      try {
        await Promise.resolve(scanner.clear())
      } catch {}
    }

    async function iniciarEscaner() {
      setIniciando(true)
      setError(null)
      scanProcesadoRef.current = false

      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('CAMERA_API_UNAVAILABLE')
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((track) => track.stop())
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
        scannerRef.current = scanner
        const configuracionEscaneo = { fps: 10, qrbox: { width: 220, height: 220 } }
        const onScanExitoso = (texto: string) => {
          if (destruido || scanProcesadoRef.current) return
          scanProcesadoRef.current = true
          onScanRef.current(texto)
        }

        try {
          await scanner.start(
            { facingMode: 'environment' },
            configuracionEscaneo,
            onScanExitoso,
            () => {}
          )
        } catch (errorCamaraTrasera) {
          const camaras = await Html5Qrcode.getCameras()
          if (camaras.length === 0) {
            throw errorCamaraTrasera
          }
          await scanner.start(
            camaras[0].id,
            configuracionEscaneo,
            onScanExitoso,
            () => {}
          )
        }
      } catch (err) {
        if (!destruido) {
          console.error('[QRScanner] Error al iniciar cámara', err)
          setError(ERROR_CAMARA)
        }
        await detenerEscaner()
      } finally {
        if (!destruido) setIniciando(false)
      }
    }
    void iniciarEscaner()

    return () => {
      destruido = true
      void detenerEscaner()
    }
  }, [activo])

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
