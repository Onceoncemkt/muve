import Link from 'next/link'

const PASOS_IOS = [
  'Abre MUVET en Safari.',
  'Toca el botón Compartir (cuadro con flecha hacia arriba).',
  'Desliza y selecciona “Agregar a pantalla de inicio”.',
  'Confirma tocando “Agregar”.',
]

const PASOS_ANDROID = [
  'Abre MUVET en Chrome.',
  'Toca el menú de tres puntos (⋮).',
  'Selecciona “Instalar app” o “Agregar a pantalla principal”.',
  'Confirma con “Instalar”.',
]

export default function InstalarPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-[#E8FF47]">Instalar MUVET</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
          >
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="max-w-2xl text-sm leading-relaxed text-white/70">
          Instala MUVET como app para abrir más rápido, usar pantalla completa y tener una experiencia más fluida en iPhone y Android.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 inline-flex rounded-full bg-[#E8FF47] px-3 py-1 text-xs font-black uppercase tracking-widest text-[#0A0A0A]">
              iPhone (Safari)
            </div>
            <ol className="space-y-3">
              {PASOS_IOS.map((paso, index) => (
                <li key={paso} className="flex gap-3 rounded-lg border border-white/10 bg-[#0F0F0F] p-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B4FE8] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm text-white/85">{paso}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 inline-flex rounded-full bg-[#E8FF47] px-3 py-1 text-xs font-black uppercase tracking-widest text-[#0A0A0A]">
              Android (Chrome)
            </div>
            <ol className="space-y-3">
              {PASOS_ANDROID.map((paso, index) => (
                <li key={paso} className="flex gap-3 rounded-lg border border-white/10 bg-[#0F0F0F] p-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B4FE8] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm text-white/85">{paso}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-8 rounded-xl border border-[#E8FF47]/30 bg-[#E8FF47]/10 p-4">
          <p className="text-sm font-semibold text-[#E8FF47]">
            Tip: Después de instalar, abre MUVET desde el ícono en tu pantalla de inicio para usarlo como app nativa.
          </p>
        </div>
      </main>
    </div>
  )
}
