import Link from 'next/link'
import PlanesPrecios from '@/components/PlanesPrecios'

const CIUDADES = [
  { nombre: 'Tulancingo', emoji: '🏔️', negocios: 4 },
  { nombre: 'Pachuca',    emoji: '⛏️', negocios: 4 },
  { nombre: 'Ensenada',   emoji: '🌊', negocios: 4 },
  { nombre: 'Tijuana',    emoji: '🌮', negocios: 8 },
]

const BENEFICIOS = [
  { icon: '🏋️', titulo: 'Gimnasios', desc: 'Entrena donde quieras con equipamiento completo' },
  { icon: '🧘', titulo: 'Clases', desc: 'Yoga, cycling, pilates y más — sin cupo fijo' },
  { icon: '✨', titulo: 'Wellness', desc: 'Estéticas, masajes y tratamientos de bienestar' },
  { icon: '🥗', titulo: 'Come bien', desc: 'Restaurantes saludables incluidos en tu membresía' },
]

export default function LandingPage() {
  const priceIds = {
    basico: process.env.STRIPE_PRICE_ID_BASICO ?? 'price_1TPWhLRzNt1SyOBv8EYKsGGP',
    plus:   process.env.STRIPE_PRICE_ID_PLUS   ?? 'price_1TPS4eRzNt1SyOBv47steWqz',
    total:  process.env.STRIPE_PRICE_ID_TOTAL  ?? 'price_1TPWhgRzNt1SyOBvrA0F50v1',
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-2xl font-black tracking-tight text-indigo-600">MUVE</span>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Únete
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-lg">
          <p className="mb-3 inline-block rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700">
            Ya disponible en 4 ciudades
          </p>
          <h1 className="text-5xl font-black leading-tight tracking-tight text-gray-900">
            Un pase.<br />
            <span className="text-indigo-600">Todo el bienestar.</span>
          </h1>
          <p className="mt-5 text-lg text-gray-500">
            Membresía mensual que te da acceso a gimnasios, clases, estéticas y restaurantes
            saludables en tu ciudad.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="#planes"
              className="w-full rounded-full bg-indigo-600 py-4 text-base font-semibold text-white hover:bg-indigo-700 sm:w-auto sm:px-10 text-center"
            >
              Ver planes
            </a>
            <Link
              href="/explorar"
              className="w-full rounded-full border border-gray-200 py-4 text-base font-medium text-gray-700 hover:border-gray-300 sm:w-auto sm:px-10 text-center"
            >
              Ver negocios →
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">¿Cómo funciona?</h2>
          <div className="flex flex-col gap-6">
            {[
              { num: '01', titulo: 'Elige tu plan', desc: 'Pago mensual desde $549. Cancela cuando quieras. Sin contratos.' },
              { num: '02', titulo: 'Obtén tu QR del día', desc: 'Cada día se genera un código único y seguro desde tu app.' },
              { num: '03', titulo: 'Escanea y entra', desc: 'El staff valida tu visita en segundos. Sin filas, sin papeles.' },
            ].map(paso => (
              <div key={paso.num} className="flex gap-5">
                <span className="text-3xl font-black text-indigo-200">{paso.num}</span>
                <div>
                  <p className="font-semibold text-gray-900">{paso.titulo}</p>
                  <p className="text-sm text-gray-500">{paso.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">Todo incluido</h2>
          <div className="grid grid-cols-2 gap-4">
            {BENEFICIOS.map(b => (
              <div key={b.titulo} className="rounded-2xl bg-gray-50 p-5">
                <p className="text-3xl">{b.icon}</p>
                <p className="mt-2 font-semibold text-gray-900">{b.titulo}</p>
                <p className="mt-1 text-sm text-gray-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <div className="bg-gray-50">
        <PlanesPrecios priceIds={priceIds} />
      </div>

      {/* Ciudades */}
      <section className="bg-indigo-600 px-6 py-16 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-2 text-2xl font-bold">Disponible en</h2>
          <p className="mb-8 text-indigo-200">Creciendo a más ciudades de México</p>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {CIUDADES.map(c => (
              <div key={c.nombre} className="text-center">
                <p className="text-4xl">{c.emoji}</p>
                <p className="mt-2 font-semibold">{c.nombre}</p>
                <p className="text-sm text-indigo-200">{c.negocios} negocios</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-6 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} MUVE · Bienestar para ciudades medianas de México
      </footer>
    </div>
  )
}
