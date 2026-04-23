'use client'

import { useState } from 'react'

export default function BotonSuscribirse({ className }: { className?: string }) {
  const [cargando, setCargando] = useState(false)

  async function iniciarCheckout() {
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      if (res.status === 401) {
        window.location.href = '/registro?redirect=checkout'
        return
      }
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
      onClick={iniciarCheckout}
      disabled={cargando}
      className={className}
    >
      {cargando ? 'Redirigiendo...' : 'Empieza desde $299 MXN/mes'}
    </button>
  )
}
