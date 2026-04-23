'use client'

import { useState, useRef } from 'react'

interface ResultadoValidacion {
  valido: boolean
  usuario?: string
  negocio?: string
  error?: string
}

export default function ValidarPage() {
  const [negocioId, setNegocioId] = useState('')
  const [token, setToken] = useState('')
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const tokenRef = useRef<HTMLInputElement>(null)

  async function validar(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim() || !negocioId.trim()) return

    setCargando(true)
    setResultado(null)

    try {
      const res = await fetch('/api/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), negocio_id: negocioId.trim() }),
      })
      const data: ResultadoValidacion = await res.json()
      setResultado(data)
      if (data.valido) setToken('')
    } catch {
      setResultado({ valido: false, error: 'Error de conexión' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Validar visita</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingresa el token del QR del cliente
          </p>
        </div>

        <form onSubmit={validar} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID del negocio
            </label>
            <input
              type="text"
              value={negocioId}
              onChange={e => setNegocioId(e.target.value)}
              placeholder="UUID del negocio"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token QR
            </label>
            <input
              ref={tokenRef}
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Escanea o ingresa el token"
              required
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <button
            type="submit"
            disabled={cargando || !token.trim() || !negocioId.trim()}
            className="rounded-xl bg-indigo-600 py-3 font-medium text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            {cargando ? 'Validando...' : 'Validar visita'}
          </button>
        </form>

        {resultado && (
          <div
            className={`mt-6 rounded-2xl p-5 text-center ${
              resultado.valido ? 'bg-green-50 ring-1 ring-green-200' : 'bg-red-50 ring-1 ring-red-200'
            }`}
          >
            <p className="text-4xl mb-2">{resultado.valido ? '✅' : '❌'}</p>
            {resultado.valido ? (
              <>
                <p className="font-bold text-green-800">¡Visita registrada!</p>
                <p className="text-sm text-green-700 mt-1">
                  {resultado.usuario} → {resultado.negocio}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-red-800">No válido</p>
                <p className="text-sm text-red-700 mt-1">{resultado.error}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
