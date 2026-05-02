'use client'

import { useMemo, useState } from 'react'
import { CIUDAD_LABELS, type Ciudad } from '@/types'

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']

type FormState = {
  nombre: string
  email: string
  ciudad: Ciudad
}

export default function PreregistroForm() {
  const [form, setForm] = useState<FormState>({
    nombre: '',
    email: '',
    ciudad: 'tulancingo',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const helperText = useMemo(() => (
    'Pre-registrarte no tiene costo. Te avisamos cuando estemos listos.'
  ), [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/preregistro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim() || null,
          email: form.email.trim(),
          ciudad: form.ciudad,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.codigo) {
        setError(payload?.error ?? 'No se pudo procesar tu preregistro.')
        return
      }

      window.location.href = `/preregistro/gracias?codigo=${encodeURIComponent(payload.codigo)}`
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 text-[#0A0A0A] shadow-2xl">
      <div className="space-y-4">
        <div>
          <label htmlFor="preregistro-nombre" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#666]">
            Nombre (opcional)
          </label>
          <input
            id="preregistro-nombre"
            type="text"
            value={form.nombre}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
            className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm outline-none focus:border-[#6B4FE8]"
            placeholder="Tu nombre"
          />
        </div>
        <div>
          <label htmlFor="preregistro-email" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#666]">
            Tu email
          </label>
          <input
            id="preregistro-email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm outline-none focus:border-[#6B4FE8]"
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <label htmlFor="preregistro-ciudad" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#666]">
            Tu ciudad
          </label>
          <select
            id="preregistro-ciudad"
            required
            value={form.ciudad}
            onChange={(event) => setForm((prev) => ({ ...prev, ciudad: event.target.value as Ciudad }))}
            className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm outline-none focus:border-[#6B4FE8]"
          >
            {CIUDADES.map((ciudad) => (
              <option key={ciudad} value={ciudad}>{CIUDAD_LABELS[ciudad]}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-[#0A0A0A] px-4 py-3 text-sm font-black uppercase tracking-wider text-[#E8FF47] transition-colors hover:bg-[#202020] disabled:opacity-60"
        >
          {enviando ? 'Apartando...' : 'Apartar mi 20% durante 3 meses'}
        </button>
        <p className="text-xs text-[#666]">{helperText}</p>
      </div>
    </form>
  )
}
