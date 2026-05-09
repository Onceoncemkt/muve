'use client'

import { useState } from 'react'

export default function BotonRenovacion() {
  const [loading, setLoading] = useState(false)

  const handleRenovar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/renovar', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Error al iniciar renovación')
        setLoading(false)
        return
      }
      if (!data?.url) {
        alert('No se pudo iniciar renovación')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('[renovar UI] error:', err)
      alert('Error al iniciar renovación. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[#E8FF47]/40 bg-[#1A1A1A] p-3">
      <p className="text-sm font-bold text-[#E8FF47]">Te quedaste sin créditos este ciclo</p>
      <p className="mt-1 text-xs text-white/70">Renueva tu plan para seguir disfrutando</p>
      <button
        type="button"
        onClick={() => void handleRenovar()}
        disabled={loading}
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#E8FF47] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#0A0A0A] transition-colors hover:bg-[#d9f53d] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Renovando...' : 'Renovar ahora'}
      </button>
    </div>
  )
}
