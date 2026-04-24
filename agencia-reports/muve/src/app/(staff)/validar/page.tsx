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
    setScannerActivo(nuevaTab === 'scanner')
  }

  const inputCls = 'w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-colors focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20'

  return (
    <div className="min-h-screen bg-[#F7F7F7] p-4">
      <div className="mx-auto max-w-sm space-y-4">

        {/* Header */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <h1 className="text-xl font-black tracking-tight text-[#0A0A0A]">Validar visita</h1>
          <p className="mt-1 text-sm text-[#888]">
            Escanea el QR del cliente para registrar su entrada
          </p>
        </div>

        {/* Selector de negocio */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[#888]">
            Negocio
          </label>
          <select
            value={negocioId}
            onChange={e => setNegocioId(e.target.value)}
            className={inputCls}
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
        <div className="flex rounded-lg border border-[#E5E5E5] bg-white p-1">
          {(['scanner', 'manual'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 rounded-md py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#888] hover:text-[#0A0A0A]'
              }`}
            >
              {t === 'scanner' ? 'Escanear' : 'Manual'}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          {tab === 'scanner' ? (
            <div className="flex flex-col gap-4">
              {!negocioId && (
                <div className="rounded-lg border border-[#E8FF47]/50 bg-[#E8FF47]/10 px-4 py-3 text-sm font-semibold text-[#0A0A0A]">
                  Selecciona un negocio antes de escanear
                </div>
              )}
              {resultado ? (
                <ResultadoBanner resultado={resultado} onReiniciar={reiniciarEscaner} />
              ) : (
                <>
                  {cargando ? (
                    <div className="flex h-64 items-center justify-center rounded-lg bg-[#F7F7F7]">
                      <p className="text-sm font-semibold text-[#888]">Validando...</p>
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
                <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[#888]">
                  Token QR
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Pega o escribe el token"
                  required
                  autoFocus
                  className={`${inputCls} font-mono`}
                />
              </div>

              <button
                type="submit"
                disabled={cargando || !token.trim() || !negocioId}
                className="rounded-lg bg-[#6B4FE8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-40"
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
      className={`flex flex-col items-center gap-3 rounded-xl p-5 text-center ${
        resultado.valido
          ? 'bg-[#E8FF47]/20 ring-1 ring-[#E8FF47]'
          : 'bg-red-50 ring-1 ring-red-200'
      }`}
    >
      {resultado.valido ? (
        <>
          <p className="text-lg font-black text-[#0A0A0A]">Visita registrada</p>
          <p className="text-sm text-[#0A0A0A]/70">
            {resultado.usuario} — {resultado.negocio}
          </p>
        </>
      ) : (
        <>
          <p className="font-black text-red-800">No válido</p>
          <p className="text-sm text-red-700">{resultado.error}</p>
        </>
      )}
      <button
        onClick={onReiniciar}
        className={`mt-1 rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
          resultado.valido
            ? 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        Siguiente
      </button>
    </div>
  )
}
