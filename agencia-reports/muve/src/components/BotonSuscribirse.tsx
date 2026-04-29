'use client'

import { useState } from 'react'

type PlanId = 'basico' | 'plus' | 'total'

export default function BotonSuscribirse({
  className,
  planId = 'basico',
}: {
  className?: string
  planId?: PlanId
}) {
  const [cargando, setCargando] = useState(false)

  async function iniciarCheckout() {
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, plan: planId }),
      })
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
