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
            { href: '/dashboard', label: 'Inicio' },
            { href: '/explorar', label: 'Explorar' },
            { href: '/historial', label: 'Historial' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 items-center justify-center py-4 text-xs font-bold uppercase tracking-widest text-[#888] hover:text-[#0A0A0A] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
