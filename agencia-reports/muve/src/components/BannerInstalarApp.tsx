'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function BannerInstalarApp() {
  const [mostrar, setMostrar] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia('(display-mode: standalone)')
    const actualizar = () => {
      setMostrar(!media.matches)
    }

    actualizar()

    const listener = () => actualizar()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }

    media.addListener(listener)
    return () => media.removeListener(listener)
  }, [])

  if (!mostrar) return null

  return (
    <div className="bg-white px-4 py-2.5 shadow-sm">
      <div className="mx-auto max-w-3xl rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2">
        <Link
          href="/instalar"
          className="text-sm font-semibold text-[#6B4FE8] transition-colors hover:text-[#4f36bf]"
        >
          Instala MUVET en tu celular →
        </Link>
      </div>
    </div>
  )
}
