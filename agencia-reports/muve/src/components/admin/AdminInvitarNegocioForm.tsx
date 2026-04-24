'use client'

import { useState } from 'react'

type NegocioOption = {
  id: string
  nombre: string
}

type Estado = 'idle' | 'saving' | 'ok' | 'error'

type Props = {
  negocios: NegocioOption[]
}

export default function AdminInvitarNegocioForm({ negocios }: Props) {
  const [negocioId, setNegocioId] = useState('')
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')

  async function invitarEncargado() {
    setEstado('saving')
    setError('')

    try {
      const res = await fetch('/api/admin/invitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          rol: 'staff',
          negocio_id: negocioId || null,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo invitar encargado.')
      }
      setEstado('ok')
      window.setTimeout(() => window.location.reload(), 700)
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'No se pudo invitar encargado.')
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#E8FF47]">
        Invitar negocio
      </h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
            Nombre del negocio
          </label>
          <select
            value={negocioId}
            onChange={event => setNegocioId(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          >
            <option value="">Selecciona</option>
            {negocios.map(negocio => (
              <option key={negocio.id} value={negocio.id}>
                {negocio.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
            Email del encargado
          </label>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="encargado@negocio.com"
            className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          />
        </div>

        {estado === 'error' && (
          <p className="text-xs font-semibold text-[#CBBEFF]">{error}</p>
        )}
        {estado === 'ok' && (
          <p className="text-xs font-semibold text-[#E8FF47]">Invitación enviada.</p>
        )}

        <button
          type="button"
          onClick={() => void invitarEncargado()}
          disabled={estado === 'saving' || !email.trim() || !negocioId}
          className="w-full rounded-md bg-[#6B4FE8] px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-[#5b40cd] disabled:opacity-50"
        >
          {estado === 'saving' ? 'Enviando...' : 'Invitar encargado'}
        </button>
      </div>
    </div>
  )
}
