'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type BotonCerrarSesionProps = {
  className?: string
}

export default function BotonCerrarSesion({ className = '' }: BotonCerrarSesionProps) {
  const router = useRouter()
  const [cerrando, setCerrando] = useState(false)

  async function cerrarSesion() {
    if (cerrando) return

    setCerrando(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      disabled={cerrando}
      aria-label="Cerrar sesión"
      className={`min-h-9 rounded-md border border-[#333333] bg-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#E8FF47] transition-colors hover:border-[#E8FF47] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8FF47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:opacity-60 ${className}`}
    >
      {cerrando ? 'Cerrando...' : 'Cerrar sesión'}
    </button>
  )
}
