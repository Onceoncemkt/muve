import Link from 'next/link'
import PlanesPrecios from '@/components/PlanesPrecios'
import { createClient } from '@/lib/supabase/server'
import type { Ciudad } from '@/types'
export default async function PlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo_descuento?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams
  const codigoDescuentoInicial = typeof params.codigo_descuento === 'string'
    ? params.codigo_descuento
    : null

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
  const priceIds = {
    centro: {
      basico: process.env.STRIPE_PRICE_ID_BASICO ?? 'price_1TPWhLRzNt1SyOBv8EYKsGGP',
      plus: process.env.STRIPE_PRICE_ID_PLUS ?? 'price_1TPS4eRzNt1SyOBv47steWqz',
      total: process.env.STRIPE_PRICE_ID_TOTAL ?? 'price_1TPWhgRzNt1SyOBvrA0F50v1',
    },
    bc: {
      basico: process.env.STRIPE_PRICE_ID_BASICO_BC ?? 'price_1TPwv9RzNt1SyOBvJZIhqZKT',
      plus: process.env.STRIPE_PRICE_ID_PLUS_BC ?? 'price_1TPwxRRzNt1SyOBvIxIRS4sM',
      total: process.env.STRIPE_PRICE_ID_TOTAL_BC ?? 'price_1TPwyuRzNt1SyOBv5lQXhhLS',
    },
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-black tracking-tight text-[#E8FF47]">
            MUVET
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/explorar"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white/50"
            >
              Ver negocios
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-[#E8FF47] px-4 py-2 text-sm font-bold text-[#0A0A0A] hover:bg-white transition-colors"
            >
              Mi dashboard
            </Link>
          </div>
        </div>
      </header>

      <PlanesPrecios
        priceIds={priceIds}
        ciudadInicial={ciudadInicial}
        usuarioAutenticado={usuarioAutenticado}
        codigoDescuentoInicial={codigoDescuentoInicial}
        mostrarCampoDescuento
      />
    </div>
  )
}
