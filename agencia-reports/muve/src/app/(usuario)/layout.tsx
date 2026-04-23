import Link from 'next/link'

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>

      {/* Nav inferior móvil */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-lg justify-around py-2">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-gray-500 hover:text-indigo-600"
          >
            <span className="text-xl">🏠</span>
            Inicio
          </Link>
          <Link
            href="/explorar"
            className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-gray-500 hover:text-indigo-600"
          >
            <span className="text-xl">🗺️</span>
            Explorar
          </Link>
          <Link
            href="/historial"
            className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs text-gray-500 hover:text-indigo-600"
          >
            <span className="text-xl">📋</span>
            Historial
          </Link>
        </div>
      </nav>
    </div>
  )
}
