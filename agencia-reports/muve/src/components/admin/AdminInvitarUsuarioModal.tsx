'use client'

import { useMemo, useState } from 'react'

type RolInvitable = 'usuario' | 'staff'

type NegocioOption = {
  id: string
  nombre: string
}

type Estado = 'idle' | 'saving' | 'ok' | 'error'

type Props = {
  negocios: NegocioOption[]
}

export default function AdminInvitarUsuarioModal({ negocios }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolInvitable>('usuario')
  const [negocioId, setNegocioId] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')

  const puedeAsignarNegocio = useMemo(() => rol === 'staff', [rol])

  async function invitar() {
    setEstado('saving')
    setError('')

    try {
      const res = await fetch('/api/admin/invitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          rol,
          negocio_id: puedeAsignarNegocio ? (negocioId || null) : null,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo enviar la invitación.')
      }
      setEstado('ok')
      window.setTimeout(() => window.location.reload(), 650)
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'No se pudo enviar la invitación.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-[#E8FF47] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]"
      >
        Invitar usuario
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111111] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                Invitar usuario
              </h3>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white/70 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="correo@dominio.com"
                  className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Rol
                </label>
                <select
                  value={rol}
                  onChange={event => setRol(event.target.value as RolInvitable)}
                  className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                >
                  <option value="usuario">usuario</option>
                  <option value="staff">staff</option>
                </select>
              </div>

              {puedeAsignarNegocio && (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                    Negocio preasignado (opcional)
                  </label>
                  <select
                    value={negocioId}
                    onChange={event => setNegocioId(event.target.value)}
                    className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                  >
                    <option value="">Sin asignar</option>
                    {negocios.map(negocio => (
                      <option key={negocio.id} value={negocio.id}>
                        {negocio.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {estado === 'error' && (
                <p className="text-xs font-semibold text-[#CBBEFF]">{error}</p>
              )}
              {estado === 'ok' && (
                <p className="text-xs font-semibold text-[#E8FF47]">Invitación enviada.</p>
              )}

              <button
                type="button"
                onClick={() => void invitar()}
                disabled={estado === 'saving' || !email.trim()}
                className="w-full rounded-md bg-[#6B4FE8] px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-[#5b40cd] disabled:opacity-50"
              >
                {estado === 'saving' ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
