import Link from 'next/link'
import BannerInstalarApp from '@/components/BannerInstalarApp'

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <BannerInstalarApp />
      <main className="flex-1">{children}</main>

      {/* Nav inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E5E5E5] bg-white">
        <div className="mx-auto flex max-w-lg">
          {[
            { href: '/dashboard', label: 'Inicio', icon: null },
            { href: '/explorar', label: 'Explorar', icon: null },
            { href: '/historial', label: 'Historial', icon: null },
            {
              href: '/perfil',
              label: 'Perfil',
              icon: (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M12 13.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ),
            },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 items-center justify-center gap-1 py-4 text-xs font-bold uppercase tracking-widest text-[#888] transition-colors hover:text-[#0A0A0A]"
            >
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
