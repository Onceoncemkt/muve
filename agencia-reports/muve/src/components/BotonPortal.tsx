'use client'

import { useState } from 'react'

export default function BotonPortal({ className }: { className?: string }) {
  const [cargando, setCargando] = useState(false)

  async function abrirPortal() {
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) { alert(error); return }
      window.location.href = url
    } catch {
      alert('Error al conectar con el servidor')
    } finally {
      setCargando(false)
    }
  }

  return (
    <button
      onClick={abrirPortal}
      disabled={cargando}
      className={className}
    >
      {cargando ? 'Cargando...' : 'Gestionar membresía'}
    </button>
  )
}
