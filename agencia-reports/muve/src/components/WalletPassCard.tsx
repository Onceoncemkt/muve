'use client'

import { useEffect, useMemo, useState } from 'react'

type PlataformaWallet = 'apple' | 'google'

interface WalletPassCardProps {
  userId: string
  appleWalletAgregado: boolean
  googleWalletAgregado: boolean
}

type WalletState = {
  plataforma: PlataformaWallet | null
  paseAgregado: boolean
}

export default function WalletPassCard({
  userId,
  appleWalletAgregado,
  googleWalletAgregado,
}: WalletPassCardProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    plataforma: null,
    paseAgregado: false,
  })
  const [cargandoAccion, setCargandoAccion] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const esIphone = /iphone/i.test(navigator.userAgent)
    const plataformaDetectada: PlataformaWallet = esIphone ? 'apple' : 'google'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWalletState({
      plataforma: plataformaDetectada,
      paseAgregado: plataformaDetectada === 'apple' ? appleWalletAgregado : googleWalletAgregado,
    })
  }, [appleWalletAgregado, googleWalletAgregado])


  const endpointWallet = useMemo(() => {
    if (!walletState.plataforma) return null
    return `/api/wallet/${walletState.plataforma}/${encodeURIComponent(userId)}`
  }, [walletState.plataforma, userId])

  const textoBoton = useMemo(() => {
    if (!walletState.plataforma) return 'Detectando dispositivo...'
    if (walletState.paseAgregado) return 'Ver mi pase'
    return walletState.plataforma === 'apple'
      ? 'Agregar a Apple Wallet'
      : 'Agregar a Google Wallet'
  }, [walletState.paseAgregado, walletState.plataforma])

  async function manejarWallet() {
    if (!endpointWallet) return
    setError(null)
    setCargandoAccion(true)

    try {
      const respuesta = await fetch(endpointWallet, { cache: 'no-store' })
      const data = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        setError(data.error ?? 'No se pudo abrir Wallet')
        return
      }

      setWalletState((prev) => ({ ...prev, paseAgregado: true }))

      if (typeof data.wallet_url === 'string' && data.wallet_url.length > 0) {
        window.location.assign(data.wallet_url)
      }
    } catch (err) {
      console.error('[WalletPassCard] error abriendo wallet:', err)
      setError('Error de conexión al abrir Wallet')
    } finally {
      setCargandoAccion(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={() => void manejarWallet()}
        disabled={!endpointWallet || cargandoAccion}
        className="w-full max-w-sm rounded-lg bg-[#6B4FE8] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cargandoAccion ? 'Abriendo Wallet...' : textoBoton}
      </button>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
