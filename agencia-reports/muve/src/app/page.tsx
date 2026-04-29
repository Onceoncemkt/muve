import Link from 'next/link'
import PlanesPrecios from '@/components/PlanesPrecios'
import { createClient } from '@/lib/supabase/server'
import type { Ciudad } from '@/types'

const PASOS = [
  { num: '01', titulo: 'Elige tu plan', desc: 'Desde $549/mes. Cancela cuando quieras. Sin contratos.' },
  { num: '02', titulo: 'Obtén tu QR', desc: 'Un código único se genera cada día en tu app.' },
  { num: '03', titulo: 'Escanea y entra', desc: 'El staff registra tu visita en segundos.' },
]

const BENEFICIOS = [
  { titulo: 'Gimnasios', desc: 'Entrena donde quieras con equipamiento completo' },
  { titulo: 'Clases', desc: 'Yoga, cycling, pilates y más — sin cupo fijo' },
  { titulo: 'Wellness', desc: 'Estéticas, masajes y tratamientos de bienestar' },
  { titulo: 'Nutrición', desc: 'Restaurantes saludables incluidos en tu membresía' },
]

const CIUDADES = [
  { nombre: 'Tulancingo', negocios: 8 },
  { nombre: 'Pachuca',    negocios: 8 },
  { nombre: 'Ensenada',   negocios: 4 },
  { nombre: 'Tijuana',    negocios: 8 },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let ciudadInicial: Ciudad = 'tulancingo'
  if (user) {
    const { data: perfil } = await supabase
      .from('users')
      .select('ciudad')
      .eq('id', user.id)
      .single<{ ciudad: Ciudad }>()
    ciudadInicial = perfil?.ciudad ?? 'tulancingo'
  }

  const usuarioAutenticado = Boolean(user)

  return (
    <div className="bg-white">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-black tracking-tight text-[#E8FF47]">
            MUVET
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-[#E8FF47] px-4 py-2 text-sm font-bold text-[#0A0A0A] hover:bg-white transition-colors"
            >
              Únete
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="bg-[#0A0A0A] px-6 pb-28 pt-24 text-center">
        <p className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
          Ya disponible en 4 ciudades de México
        </p>
        <h1 className="mx-auto max-w-3xl text-6xl font-black leading-none tracking-tight sm:text-7xl lg:text-8xl">
          <span className="block text-white">UN PASE.</span>
          <span className="block text-[#E8FF47]">TODO LO QUE</span>
          <span className="block text-[#E8FF47]">TE HACE BIEN.</span>
        </h1>
        <p className="mx-auto mt-8 max-w-md text-base text-white/50">
          Membresía mensual que te da acceso a gimnasios, clases, estéticas
          y restaurantes saludables en tu ciudad.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="#planes"
            className="w-full rounded-lg bg-[#E8FF47] px-8 py-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white sm:w-auto"
          >
            Ver planes
          </a>
          <Link
            href="/explorar"
            className="w-full rounded-lg border border-white/20 px-8 py-4 text-sm font-semibold text-white transition-colors hover:border-white/50 sm:w-auto"
          >
            Ver negocios
          </Link>
        </div>
      </section>

      {/* ── COMO FUNCIONA ───────────────────────────────────── */}
      <section className="bg-[#0A0A0A] border-t border-white/10 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-2xl font-black text-white">
            Como funciona
          </h2>
          <div className="flex flex-col gap-10">
            {PASOS.map(paso => (
              <div key={paso.num} className="flex gap-6">
                <span className="shrink-0 text-5xl font-black leading-none text-[#E8FF47]/30">
                  {paso.num}
                </span>
                <div className="pt-1">
                  <p className="font-bold text-white">{paso.titulo}</p>
                  <p className="mt-1 text-sm text-white/50">{paso.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFICIOS ──────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-2xl font-black text-[#0A0A0A]">
            Todo incluido
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {BENEFICIOS.map(b => (
              <div key={b.titulo} className="rounded-xl border border-[#E5E5E5] p-5">
                <p className="font-bold text-[#0A0A0A]">{b.titulo}</p>
                <p className="mt-1 text-sm text-[#888]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ──────────────────────────────────────────── */}
      <div className="bg-[#F7F7F7]">
        <PlanesPrecios
          ciudadInicial={ciudadInicial}
          usuarioAutenticado={usuarioAutenticado}
        />
      </div>

      {/* ── CIUDADES ────────────────────────────────────────── */}
      <section className="bg-[#0A0A0A] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-center text-2xl font-black text-white">
            Disponible en
          </h2>
          <p className="mb-10 text-center text-sm text-white/40">
            Creciendo a más ciudades de México
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CIUDADES.map(c => (
              <div key={c.nombre} className="rounded-xl border border-white/10 p-5">
                <p className="font-bold text-white">{c.nombre}</p>
                <p className="mt-1 text-sm font-semibold text-[#E8FF47]">
                  {c.negocios} negocios
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-[#0A0A0A] border-t border-white/10 px-6 py-8 text-center">
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} MUVET · Todo el wellness en una app
        </p>
      </footer>
    </div>
  )
}
