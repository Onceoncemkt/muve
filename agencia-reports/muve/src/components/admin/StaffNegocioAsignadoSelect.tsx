'use client'

import { useMemo, useState } from 'react'

type NegocioOption = {
  id: string
  nombre: string
}

type EstadoGuardado = 'idle' | 'saving' | 'ok' | 'error'

type Props = {
  userId: string
  negocioIdActual: string | null
  negocioActualNombre: string | null
  negocioActualActivo: boolean
  opciones: NegocioOption[]
}

export default function StaffNegocioAsignadoSelect({
  userId,
  negocioIdActual,
  negocioActualNombre,
  negocioActualActivo,
  opciones,
}: Props) {
  const [negocioId, setNegocioId] = useState(negocioIdActual ?? '')
  const [estado, setEstado] = useState<EstadoGuardado>('idle')
  const [error, setError] = useState('')

  const mostrarOpcionActualInactiva = useMemo(() => {
    if (!negocioIdActual || !negocioActualNombre || negocioActualActivo) return false
    return !opciones.some(opcion => opcion.id === negocioIdActual)
  }, [negocioActualActivo, negocioActualNombre, negocioIdActual, opciones])

  async function actualizarNegocio(nuevoNegocioId: string) {
    setEstado('saving')
    setError('')

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/negocio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: nuevoNegocioId || null,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const mensaje = typeof payload.error === 'string'
          ? payload.error
          : 'No se pudo actualizar el negocio asignado.'
        throw new Error(mensaje)
      }

      setEstado('ok')
      window.setTimeout(() => setEstado('idle'), 1400)
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el negocio asignado.')
    }
  }

  return (
    <div className="min-w-[13rem] space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
        Negocio asignado
      </label>
      <select
        value={negocioId}
        onChange={event => {
          const value = event.target.value
          setNegocioId(value)
          void actualizarNegocio(value)
        }}
        disabled={estado === 'saving'}
        className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8] disabled:opacity-60"
      >
        <option value="">Sin asignar</option>
        {mostrarOpcionActualInactiva && negocioIdActual && negocioActualNombre && (
          <option value={negocioIdActual}>
            {negocioActualNombre} (inactivo)
          </option>
        )}
        {opciones.map(opcion => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombre}
          </option>
        ))}
      </select>

      {estado === 'saving' && (
        <p className="text-[11px] font-semibold text-white/45">Guardando...</p>
      )}
      {estado === 'ok' && (
        <p className="text-[11px] font-semibold text-[#E8FF47]">Negocio actualizado.</p>
      )}
      {estado === 'error' && (
        <p className="text-[11px] font-semibold text-[#CBBEFF]">{error}</p>
      )}
    </div>
  )
}
