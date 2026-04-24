'use client'

import { useState } from 'react'

type Estado = 'idle' | 'saving' | 'error'

type Props = {
  userId: string
  planActivo: boolean
}

export default function AdminUsuarioPlanToggle({ userId, planActivo }: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')

  async function toggle() {
    setEstado('saving')
    setError('')

    try {
      const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(userId)}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_activo: !planActivo }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo actualizar plan.')
      }
      window.location.reload()
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'No se pudo actualizar plan.')
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={estado === 'saving'}
        className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
          planActivo
            ? 'bg-[#6B4FE8] text-white hover:bg-[#5b40cd]'
            : 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#d8f03f]'
        } disabled:opacity-60`}
      >
        {planActivo ? 'Desactivar plan' : 'Activar plan'}
      </button>
      {estado === 'error' && <p className="text-[11px] font-semibold text-[#CBBEFF]">{error}</p>}
    </div>
  )
}
