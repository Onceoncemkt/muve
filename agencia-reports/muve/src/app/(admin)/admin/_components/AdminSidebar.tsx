'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'

type Item = {
  href: string
  label: string
  // ruta exacta (Dashboard) o prefijo
  exact?: boolean
  icon: React.ReactNode
}

function Icono({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      <path d={path} />
    </svg>
  )
}

const ITEMS: Item[] = [
  { href: '/admin', label: 'Dashboard', exact: true, icon: <Icono path="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z" /> },
  { href: '/admin/negocios', label: 'Negocios', icon: <Icono path="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" /> },
  { href: '/admin/usuarios', label: 'Usuarios', icon: <Icono path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> },
  { href: '/admin/reservaciones', label: 'Reservaciones', icon: <Icono path="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /> },
  { href: '/admin/finanzas', label: 'Finanzas', icon: <Icono path="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
  { href: '/admin/configuracion', label: 'Configuración', icon: <Icono path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H1a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 2.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H7a1.65 1.65 0 0 0 1-1.51V1a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V7a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /> },
]

export default function AdminSidebar({ previewLocal = false }: { previewLocal?: boolean }) {
  const pathname = usePathname()

  const esActivo = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <>
      {/* Sidebar fijo en desktop */}
      <aside className="glass-panel scroll-fina fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/admin" className="text-lg font-black tracking-tight text-[#E8FF47]">MUVET</Link>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-white/45">Panel Admin</p>
          {previewLocal && (
            <span className="mt-2 inline-block rounded-md bg-[#6B4FE8]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#CBBEFF]">
              Preview local
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {ITEMS.map((item) => {
            const activo = esActivo(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                  activo
                    ? 'bg-gradient-to-r from-[#E8FF47]/18 to-transparent text-[#E8FF47] ring-1 ring-[#E8FF47]/25 shadow-[0_6px_22px_-12px_rgba(232,255,71,0.6)]'
                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <BotonCerrarSesion />
        </div>
      </aside>

      {/* Nav superior horizontal en móvil */}
      <div className="glass-panel sticky top-0 z-30 border-b border-white/10 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-base font-black tracking-tight text-[#E8FF47]">MUVET</Link>
          <div className="flex items-center gap-2">
            {previewLocal && (
              <span className="rounded-md bg-[#6B4FE8]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#CBBEFF]">
                Preview
              </span>
            )}
            <BotonCerrarSesion />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {ITEMS.map((item) => {
            const activo = esActivo(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  activo
                    ? 'bg-gradient-to-r from-[#E8FF47]/18 to-transparent text-[#E8FF47] ring-1 ring-[#E8FF47]/25'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
