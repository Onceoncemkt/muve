'use client'

import { useState } from 'react'

export default function ImpersonarNegocioButton({ negocioId }: { negocioId: string }) {
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function entrar() {
    setCargando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/admin/impersonar-negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio_id: negocioId }),
      })
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }))
      if (!res.ok || !data.url) {
        setMensaje(data.error ?? 'No se pudo entrar como negocio')
        return
      }
      // Abre la sesión del negocio en una pestaña nueva.
      window.open(data.url, '_blank', 'noopener')
    } catch {
      setMensaje('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={entrar}
        disabled={cargando}
        className="w-full rounded-md border border-[#E8FF47]/40 bg-[#E8FF47]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#E8FF47] hover:bg-[#E8FF47]/20 disabled:opacity-50"
      >
        {cargando ? 'Generando acceso…' : '👁 Ver como negocio'}
      </button>
      {mensaje && <p className="text-[11px] font-semibold text-yellow-200">{mensaje}</p>}
    </div>
  )
}
