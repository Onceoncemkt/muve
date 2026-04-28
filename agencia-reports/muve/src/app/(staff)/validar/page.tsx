'use client'

import { useState, useEffect, useCallback } from 'react'
import QRScanner from '@/components/QRScanner'
import type { Negocio } from '@/types'
import { normalizarCategoriaNegocio } from '@/lib/planes'

type Tab = 'scanner' | 'manual'
type RolValidar = 'staff' | 'admin'
type NegocioContexto = Pick<Negocio, 'id' | 'nombre' | 'ciudad'>

interface ResultadoValidacion {
  valido: boolean
  usuario?: string
  negocio?: string
  categoria_negocio?: string | null
  monto_negocio_mxn?: number | null
  servicio_reservado?: {
    id: string
    nombre: string
    precio_normal_mxn: number | null
    fecha: string
  } | null
  monto_maximo_autorizado_mxn?: number | null
  error?: string
  visitas_restantes_mes?: number
  visitas_usadas_mes?: number
  limite_visitas_mensuales?: number
}

function ciudadLabel(ciudad: string | null | undefined) {
  if (!ciudad) return 'Sin ciudad'
  return ciudad.charAt(0).toUpperCase() + ciudad.slice(1)
}

function formatMoneyMxn(monto: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(monto)
}

export default function ValidarPage() {
  const [tab, setTab] = useState<Tab>('scanner')
  const [rol, setRol] = useState<RolValidar | null>(null)
  const [negocios, setNegocios] = useState<NegocioContexto[]>([])
  const [negocioAsignado, setNegocioAsignado] = useState<NegocioContexto | null>(null)
  const [negocioId, setNegocioId] = useState('')
  const [token, setToken] = useState('')
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoContexto, setCargandoContexto] = useState(true)
  const [errorContexto, setErrorContexto] = useState<string | null>(null)
  const [scannerActivo, setScannerActivo] = useState(true)

  useEffect(() => {
    let activo = true

    async function cargarContexto() {
      setCargandoContexto(true)

      const res = await fetch('/api/negocio/negocios', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!activo) return

      if (!res.ok) {
        setRol(null)
        setNegocios([])
        setNegocioAsignado(null)
        setNegocioId('')
        setErrorContexto(data.error ?? 'No se pudo cargar el contexto de validación')
        setCargandoContexto(false)
        return
      }

      const rolRespuesta = data.rol as RolValidar | undefined
      if (!rolRespuesta || !['staff', 'admin'].includes(rolRespuesta)) {
        setRol(null)
        setNegocios([])
        setNegocioAsignado(null)
        setNegocioId('')
        setErrorContexto('Sin permisos para validar visitas')
        setCargandoContexto(false)
        return
      }

      const lista = (data.negocios ?? []) as NegocioContexto[]
      setRol(rolRespuesta)

      if (rolRespuesta === 'staff') {
        const asignado = lista[0] ?? null
        if (!asignado) {
          setNegocios([])
          setNegocioAsignado(null)
          setNegocioId('')
          setErrorContexto('Tu cuenta no tiene negocio asignado')
          setCargandoContexto(false)
          return
        }

        setNegocios([])
        setNegocioAsignado(asignado)
        setNegocioId(asignado.id)
        setErrorContexto(null)
        setCargandoContexto(false)
        return
      }

      setNegocioAsignado(null)
      setNegocios(lista)
      setNegocioId(prev => prev || lista[0]?.id || '')
      setErrorContexto(null)
      setCargandoContexto(false)
    }

    void cargarContexto()
    return () => {
      activo = false
    }
  }, [])

  async function enviarValidacion(tokenAValidar: string) {
    if (!negocioId) {
      setResultado({
        valido: false,
        error: rol === 'admin' ? 'Selecciona un negocio primero' : 'Tu cuenta no tiene negocio asignado',
      })
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

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <h1 className="text-xl font-black tracking-tight text-[#0A0A0A]">Validar visita</h1>
          <p className="mt-1 text-sm text-[#888]">
            Escanea el QR del cliente para registrar su entrada
          </p>
        </div>

        {rol === 'admin' ? (
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
                  {n.nombre} — {ciudadLabel(n.ciudad)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
            <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[#888]">
              Negocio asignado
            </label>
            <p className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm font-semibold text-[#0A0A0A]">
              {negocioAsignado
                ? `${negocioAsignado.nombre} — ${ciudadLabel(negocioAsignado.ciudad)}`
                : (errorContexto ?? 'Cargando negocio...')}
            </p>
          </div>
        )}

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

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          {tab === 'scanner' ? (
            <div className="flex flex-col gap-4">
              {cargandoContexto && (
                <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm font-semibold text-[#888]">
                  Cargando contexto de negocio...
                </div>
              )}
              {errorContexto && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorContexto}
                </div>
              )}
              {!negocioId && (
                <div className="rounded-lg border border-[#E8FF47]/50 bg-[#E8FF47]/10 px-4 py-3 text-sm font-semibold text-[#0A0A0A]">
                  No hay negocio disponible para escanear
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
  const categoriaNegocio = normalizarCategoriaNegocio(resultado.categoria_negocio)
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl p-5 text-center ${
        resultado.valido
          ? 'bg-green-50 ring-1 ring-green-300'
          : 'bg-red-50 ring-1 ring-red-200'
      }`}
    >
      {resultado.valido ? (
        <>
          <p className="text-lg font-black text-green-700">Visita registrada</p>
          <p className="text-sm text-green-700">
            {resultado.usuario} — {resultado.negocio}
          </p>
          {categoriaNegocio === 'estetica' && resultado.servicio_reservado && (
            <div className="w-full rounded-lg border border-green-200 bg-white/80 px-3 py-2 text-left">
              <p className="text-[11px] font-black uppercase tracking-widest text-green-700">Servicio a dar</p>
              <p className="text-sm font-semibold text-green-800">{resultado.servicio_reservado.nombre}</p>
              {typeof resultado.servicio_reservado.precio_normal_mxn === 'number' && (
                <p className="text-xs text-green-700">
                  Precio normal:{' '}
                  <span className="line-through">{formatMoneyMxn(resultado.servicio_reservado.precio_normal_mxn)}</span>
                </p>
              )}
            </div>
          )}
          {categoriaNegocio === 'restaurante' && (
            <p className="rounded-full bg-green-600/90 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
              Monto a dar:{' '}
              {formatMoneyMxn(
                (typeof resultado.monto_maximo_autorizado_mxn === 'number'
                  ? resultado.monto_maximo_autorizado_mxn
                  : resultado.monto_negocio_mxn) ?? 0
              )}
            </p>
          )}
          <p className="text-sm font-semibold text-green-700">
            Visitas restantes: {resultado.visitas_restantes_mes ?? 0}
            {typeof resultado.limite_visitas_mensuales === 'number'
              ? ` de ${resultado.limite_visitas_mensuales}`
              : ''}
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
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        Siguiente
      </button>
    </div>
  )
}
