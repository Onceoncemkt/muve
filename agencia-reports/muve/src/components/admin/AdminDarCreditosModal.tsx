'use client'

import { useMemo, useState } from 'react'

type Estado = 'idle' | 'saving' | 'ok' | 'error'
type Operacion = 'agregar' | 'quitar'

type Props = {
  userId: string
  userNombre: string
}

const MOTIVOS_SUGERIDOS = [
  'Compensación por error',
  'Premio',
  'Cortesía',
  'Problema técnico',
]

export default function AdminDarCreditosModal({ userId, userNombre }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [operacion, setOperacion] = useState<Operacion>('agregar')
  const [cantidad, setCantidad] = useState('1')
  const [motivo, setMotivo] = useState(MOTIVOS_SUGERIDOS[0])
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')

  const cantidadNumero = useMemo(() => {
    const parsed = Number.parseInt(cantidad, 10)
    if (!Number.isFinite(parsed)) return 0
    return parsed
  }, [cantidad])

  async function confirmar() {
    const motivoLimpio = motivo.trim()
    if (cantidadNumero < 1 || cantidadNumero > 50) {
      setEstado('error')
      setError('La cantidad debe estar entre 1 y 50 créditos.')
      return
    }
    if (!motivoLimpio) {
      setEstado('error')
      setError('El motivo es obligatorio.')
      return
    }

    setEstado('saving')
    setError('')

    try {
      const response = await fetch('/api/admin/creditos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          cantidad: cantidadNumero,
          motivo: motivoLimpio,
          operacion,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : operacion === 'agregar'
              ? 'No se pudieron otorgar créditos.'
              : 'No se pudieron retirar créditos.'
        )
      }

      setEstado('ok')
      window.setTimeout(() => {
        setAbierto(false)
        window.location.reload()
      }, 350)
    } catch (err) {
      setEstado('error')
      setError(
        err instanceof Error
          ? err.message
          : operacion === 'agregar'
            ? 'No se pudieron otorgar créditos.'
            : 'No se pudieron retirar créditos.'
      )
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierto(true)
          setOperacion('agregar')
          setEstado('idle')
          setError('')
        }}
        className="rounded-md border border-[#E8FF47] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#E8FF47] hover:bg-[#E8FF47]/10"
      >
        Ajustar créditos
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-[#111111] p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                  Ajustar créditos
                </h3>
                <p className="mt-1 text-xs text-white/60">
                  Usuario: {userNombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white/70 hover:border-white/45 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Operación
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperacion('agregar')}
                    className={`rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                      operacion === 'agregar'
                        ? 'border-[#E8FF47] bg-[#E8FF47]/15 text-[#E8FF47]'
                        : 'border-white/15 text-white/75 hover:border-[#E8FF47]/60'
                    }`}
                  >
                    Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperacion('quitar')}
                    className={`rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                      operacion === 'quitar'
                        ? 'border-red-400 bg-red-500/15 text-red-200'
                        : 'border-white/15 text-white/75 hover:border-red-400/60'
                    }`}
                  >
                    Quitar
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Cantidad de créditos (1-50)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                  Motivo
                </label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  list={`motivos-${userId}`}
                  className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                />
                <datalist id={`motivos-${userId}`}>
                  {MOTIVOS_SUGERIDOS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            {estado === 'error' && (
              <p className="mt-3 rounded-md border border-[#6B4FE8]/40 bg-[#6B4FE8]/10 px-3 py-2 text-xs font-semibold text-[#CBBEFF]">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/75 hover:border-white/40 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={estado === 'saving'}
                className={`rounded-md px-3 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-60 ${
                  operacion === 'agregar'
                    ? 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#f1ff89]'
                    : 'bg-red-500 text-white hover:bg-red-400'
                }`}
              >
                {estado === 'saving'
                  ? 'Guardando...'
                  : operacion === 'agregar'
                    ? 'Agregar créditos'
                    : 'Quitar créditos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
