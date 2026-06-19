'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type BotonCerrarSesionProps = {
  className?: string
  variant?: 'dark' | 'light'
}

const VARIANTES = {
  dark: 'border-[#333333] bg-transparent text-[#E8FF47] hover:border-[#E8FF47] hover:text-white focus-visible:ring-offset-[#0A0A0A]',
  light: 'border-[#E5E5E5] bg-white text-[#666] hover:border-[#0A0A0A] hover:text-[#0A0A0A] focus-visible:ring-offset-white',
}

export default function BotonCerrarSesion({ className = '', variant = 'dark' }: BotonCerrarSesionProps) {
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
      className={`min-h-9 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8FF47] focus-visible:ring-offset-2 disabled:opacity-60 ${VARIANTES[variant]} ${className}`}
    >
      {cerrando ? 'Cerrando...' : 'Cerrar sesión'}
    </button>
  )
}
