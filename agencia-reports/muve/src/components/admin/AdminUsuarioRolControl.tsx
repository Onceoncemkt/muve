'use client'

import { useState } from 'react'

type Rol = 'usuario' | 'staff' | 'admin'
type Estado = 'idle' | 'saving' | 'ok' | 'error'

type Props = {
  userId: string
  rolActual: Rol
}

export default function AdminUsuarioRolControl({ userId, rolActual }: Props) {
  const [rol, setRol] = useState<Rol>(rolActual)
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')

  async function guardar() {
    setEstado('saving')
    setError('')

    try {
      const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(userId)}/rol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo actualizar rol.')
      }
      setEstado('ok')
      window.setTimeout(() => window.location.reload(), 450)
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'No se pudo actualizar rol.')
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={rol}
          onChange={event => setRol(event.target.value as Rol)}
          disabled={estado === 'saving'}
          className="rounded-md border border-white/15 bg-[#151515] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#6B4FE8] disabled:opacity-60"
        >
          <option value="usuario">usuario</option>
          <option value="staff">staff</option>
          <option value="admin">admin</option>
        </select>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={estado === 'saving'}
          className="rounded-md border border-[#6B4FE8] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#CBBEFF] hover:bg-[#6B4FE8]/20 disabled:opacity-60"
        >
          Cambiar rol
        </button>
      </div>

      {estado === 'saving' && <p className="text-[11px] text-white/45">Guardando rol...</p>}
      {estado === 'error' && <p className="text-[11px] font-semibold text-[#CBBEFF]">{error}</p>}
    </div>
  )
}
