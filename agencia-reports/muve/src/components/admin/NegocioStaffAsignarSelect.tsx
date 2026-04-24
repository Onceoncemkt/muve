'use client'

import { useState } from 'react'

type StaffOption = {
  id: string
  nombre: string
  email: string
  negocioNombreActual: string | null
}

type Estado = 'idle' | 'saving' | 'ok' | 'error'

type Props = {
  negocioId: string
  opciones: StaffOption[]
}

export default function NegocioStaffAsignarSelect({ negocioId, opciones }: Props) {
  const [staffId, setStaffId] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')

  async function asignar(staffUserId: string) {
    if (!staffUserId) return

    setEstado('saving')
    setError('')

    try {
      const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(staffUserId)}/negocio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio_id: negocioId }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'No se pudo asignar el staff.'
        )
      }

      setEstado('ok')
      window.setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'No se pudo asignar el staff.')
    }
  }

  return (
    <div className="min-w-[16rem] space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
        Asignar staff
      </label>
      <select
        value={staffId}
        onChange={event => {
          const value = event.target.value
          setStaffId(value)
          void asignar(value)
        }}
        disabled={estado === 'saving' || opciones.length === 0}
        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8] disabled:opacity-60"
      >
        <option value="">{opciones.length === 0 ? 'Sin staff disponible' : 'Selecciona staff'}</option>
        {opciones.map(opcion => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombre} · {opcion.negocioNombreActual ? `en ${opcion.negocioNombreActual}` : 'sin asignar'}
          </option>
        ))}
      </select>

      {estado === 'saving' && (
        <p className="text-[11px] font-semibold text-white/45">Guardando asignación...</p>
      )}
      {estado === 'ok' && (
        <p className="text-[11px] font-semibold text-[#E8FF47]">Staff asignado.</p>
      )}
      {estado === 'error' && (
        <p className="text-[11px] font-semibold text-[#CBBEFF]">{error}</p>
      )}
    </div>
  )
}
