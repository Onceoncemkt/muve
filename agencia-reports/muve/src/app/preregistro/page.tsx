import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { CIUDAD_LABELS, type Ciudad } from '@/types'
import PreregistroForm from './PreregistroForm'

export const dynamic = 'force-dynamic'

type NegocioLanding = {
  id: string
  nombre: string
  logo_url: string | null
  mostrar_en_landing?: boolean
  activo?: boolean
}

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']

async function obtenerAliados() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('negocios')
    .select('id, nombre, logo_url, mostrar_en_landing, activo')
    .eq('mostrar_en_landing', true)
    .eq('activo', true)
    .order('nombre')

  if (!error) return (data ?? []) as NegocioLanding[]

  const { data: fallback, error: fallbackError } = await db
    .from('negocios')
    .select('id, nombre, logo_url, activo')
    .eq('activo', true)
    .order('nombre')
    .limit(12)

  if (fallbackError) {
    console.warn('[preregistro] no se pudieron cargar aliados', fallbackError.message)
    return []
  }
  return (fallback ?? []) as NegocioLanding[]
}

export default async function PreregistroPage() {
  const aliados = await obtenerAliados()

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-6 py-10">
        <div className="absolute right-0 top-0 h-0 w-0 border-l-[140px] border-b-[140px] border-l-transparent border-b-[#E8FF47]" />
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-lg font-black tracking-[0.16em] text-[#E8FF47]">MUVET</p>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#E8FF47]">Próximamente</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.02] text-white md:text-6xl">
            Una membresía. Cientos de lugares.
          </h1>
          <p className="mt-4 text-sm text-white/70 md:text-base">
            {CIUDADES.map((ciudad) => CIUDAD_LABELS[ciudad]).join(' · ')}
          </p>
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#E8FF47] px-5 py-4 text-[#0A0A0A]">
              <p className="text-2xl font-black tracking-tight">🎁 20% OFF tu primer mes</p>
              <p className="mt-1 text-sm font-semibold">
                Reserva tu descuento antes del lanzamiento y entra primero al club.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-black uppercase tracking-widest text-[#E8FF47]">Aliados confirmados</h2>
              {aliados.length === 0 ? (
                <p className="mt-4 text-sm text-white/60">Pronto publicaremos nuestros aliados en cada ciudad.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {aliados.map((negocio) => (
                    <div
                      key={negocio.id}
                      className="flex min-h-20 items-center justify-center rounded-xl border border-white/10 bg-[#151515] px-3 py-2"
                    >
                      {negocio.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={negocio.logo_url} alt={negocio.nombre} className="max-h-10 max-w-full object-contain" />
                      ) : (
                        <p className="text-center text-xs font-semibold text-white/70">{negocio.nombre}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <PreregistroForm />
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-white/60">
          <p>MUVET · Wellness Club</p>
          <Link href="/" className="font-semibold text-[#E8FF47] hover:text-[#f1ff89]">Volver al inicio</Link>
        </div>
      </footer>
    </main>
  )
}
