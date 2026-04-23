'use client'

import { useState, useEffect, useCallback } from 'react'
import QRScanner from '@/components/QRScanner'
import { createClient } from '@/lib/supabase/client'
import type { Negocio } from '@/types'

type Tab = 'scanner' | 'manual'

interface ResultadoValidacion {
  valido: boolean
  usuario?: string
  negocio?: string
  error?: string
}

export default function ValidarPage() {
  const [tab, setTab] = useState<Tab>('scanner')
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [negocioId, setNegocioId] = useState('')
  const [token, setToken] = useState('')
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [scannerActivo, setScannerActivo] = useState(true)

  // Cargar negocios del staff (todos activos, el staff selecciona el suyo)
  useEffect(() => {
    async function cargarNegocios() {
      const supabase = createClient()
      const { data } = await supabase
        .from('negocios')
        .select('id, nombre, ciudad, categoria')
        .eq('activo', true)
        .order('ciudad')
        .order('nombre')
      if (data) setNegocios(data as Negocio[])
    }
    cargarNegocios()
  }, [])

  async function enviarValidacion(tokenAValidar: string) {
    if (!negocioId) {
      setResultado({ valido: false, error: 'Selecciona un negocio primero' })
      return
    }
    if (!tokenAValidar.trim()) return

    setCargando(true)
    setResultado(null)
    // Pausar el escáner mientras se procesa para no re-escanear
    setScannerActivo(false)

    try {
      const res = await fetch('/api/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAValidar.trim(), negocio_id: negocioId }),
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

  // useCallback para que el efecto del scanner no se reinstancie en cada render
  const handleScan = useCallback((texto: string) => {
    setToken(texto)
    enviarValidacion(texto)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId])

  function reiniciarEscaner() {
    setResultado(null)
    setToken('')
    setScannerActivo(true)
  }

  function handleTabChange(nuevaTab: Tab) {
    setTab(nuevaTab)
    setResultado(null)
    setToken('')
    // Apagar cámara al cambiar a manual, reactivar al volver al scanner
    setScannerActivo(nuevaTab === 'scanner')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-sm space-y-4">

        {/* Header */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Validar visita</h1>
          <p className="mt-1 text-sm text-gray-500">
            Escanea el QR del cliente para registrar su entrada
          </p>
        </div>

        {/* Selector de negocio */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Negocio
          </label>
          <select
            value={negocioId}
            onChange={e => setNegocioId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Selecciona tu negocio...</option>
            {negocios.map(n => (
              <option key={n.id} value={n.id}>
                {n.nombre} — {n.ciudad.charAt(0).toUpperCase() + n.ciudad.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-gray-100 p-1">
          {(['scanner', 'manual'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'scanner' ? '📷 Escanear' : '⌨️ Manual'}
            </button>
          ))}
        </div>

        {/* Panel principal */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {tab === 'scanner' ? (
            <div className="flex flex-col gap-4">
              {!negocioId && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Selecciona un negocio antes de escanear
                </div>
              )}

              {resultado ? (
                <ResultadoBanner resultado={resultado} onReiniciar={reiniciarEscaner} />
              ) : (
                <>
                  {cargando ? (
                    <div className="flex h-64 items-center justify-center rounded-2xl bg-gray-50">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        <p className="text-sm text-gray-400">Validando...</p>
                      </div>
                    </div>
                  ) : (
                    <QRScanner onScan={handleScan} activo={scannerActivo && !!negocioId} />
                  )}
                </>
              )}
            </div>
          ) : (
            <form
              onSubmit={e => { e.preventDefault(); enviarValidacion(token) }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token QR
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Pega o escribe el token"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <button
                type="submit"
                disabled={cargando || !token.trim() || !negocioId}
                className="rounded-xl bg-indigo-600 py-3 font-medium text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors"
              >
                {cargando ? 'Validando...' : 'Validar visita'}
              </button>

              {resultado && (
                <ResultadoBanner resultado={resultado} onReiniciar={reiniciarEscaner} />
              )}
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

function ResultadoBanner({
  resultado,
  onReiniciar,
}: {
  resultado: ResultadoValidacion
  onReiniciar: () => void
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl p-5 text-center ${
        resultado.valido ? 'bg-green-50 ring-1 ring-green-200' : 'bg-red-50 ring-1 ring-red-200'
      }`}
    >
      <p className="text-5xl">{resultado.valido ? '✅' : '❌'}</p>
      {resultado.valido ? (
        <>
          <p className="text-lg font-bold text-green-800">¡Visita registrada!</p>
          <p className="text-sm text-green-700">
            {resultado.usuario} → {resultado.negocio}
          </p>
        </>
      ) : (
        <>
          <p className="font-bold text-red-800">No válido</p>
          <p className="text-sm text-red-700">{resultado.error}</p>
        </>
      )}
      <button
        onClick={onReiniciar}
        className={`mt-1 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
          resultado.valido
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        Escanear siguiente
      </button>
    </div>
  )
}
