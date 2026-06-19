'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'

const TABS = [
  { href: '/negocio/dashboard', label: 'Dashboard' },
  { href: '/negocio/horarios', label: 'Horarios' },
  { href: '/negocio/validadores', label: 'Validadores' },
  { href: '/negocio/perfil', label: 'Perfil' },
  { href: '/validar', label: 'Escáner' },
]

export default function NegocioNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/negocio/dashboard" className="flex items-baseline gap-2">
          <span className="text-lg font-black tracking-tight text-[#0A0A0A]">MUVET</span>
          <span className="hidden text-[11px] font-bold uppercase tracking-widest text-[#999] sm:inline">Mi negocio</span>
        </Link>
        <BotonCerrarSesion variant="light" />
      </div>
      <nav className="mx-auto -mb-px flex w-full max-w-5xl gap-1 overflow-x-auto px-2">
        {TABS.map((tab) => {
          const activo = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                activo
                  ? 'border-[#E8FF47] font-black text-[#0A0A0A]'
                  : 'border-transparent font-bold text-[#999] hover:text-[#0A0A0A]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
