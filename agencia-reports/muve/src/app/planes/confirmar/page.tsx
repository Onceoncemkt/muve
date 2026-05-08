import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CREDITOS_POR_PLAN, PLAN_LABELS, PRECIOS_MEMBRESIA_POR_REGION, esCiudadBC, normalizarPlan } from '@/lib/planes'
import { CIUDAD_LABELS, normalizarCiudadOperativa, type Ciudad, type PlanMembresia } from '@/types'
import ConfirmarCheckoutClient from './ConfirmarCheckoutClient'

function zonaDesdeCiudad(ciudad: Ciudad): 'zona1' | 'zona2' {
  return esCiudadBC(ciudad) ? 'zona2' : 'zona1'
}

export default async function ConfirmarPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; ciudad?: string; codigo_descuento?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const plan = (normalizarPlan(params.plan) ?? 'basico') as PlanMembresia
  const ciudadDesdeQuery = normalizarCiudadOperativa(params.ciudad)
  let ciudad = ciudadDesdeQuery ?? 'tulancingo'

  if (user) {
    const { data: perfil } = await supabase
      .from('users')
      .select('ciudad')
      .eq('id', user.id)
      .single<{ ciudad: Ciudad }>()
    const ciudadPerfil = normalizarCiudadOperativa(perfil?.ciudad)
    ciudad = ciudadDesdeQuery ?? ciudadPerfil ?? 'tulancingo'
  }

  const zona = zonaDesdeCiudad(ciudad)
  const region = zona === 'zona2' ? 'bc' : 'centro'
  const precioMensual = PRECIOS_MEMBRESIA_POR_REGION[region][plan]
  const codigoDescuento = typeof params.codigo_descuento === 'string' ? params.codigo_descuento : null
  const backHref = user
    ? '/perfil'
    : `/planes${codigoDescuento ? `?codigo_descuento=${encodeURIComponent(codigoDescuento)}` : ''}`

  return (
    <main className="min-h-screen bg-[#F7F7F7] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link href="/planes" className="text-sm font-semibold text-[#6B4FE8] underline-offset-4 hover:underline">
          ← Volver a planes
        </Link>
        <ConfirmarCheckoutClient
          planId={plan}
          ciudadLabel={CIUDAD_LABELS[ciudad]}
          ciudadValue={ciudad}
          zonaLabel={zona}
          planLabel={PLAN_LABELS[plan]}
          creditos={CREDITOS_POR_PLAN[plan]}
          precioMensual={precioMensual}
          backHref={backHref}
          codigoDescuento={codigoDescuento}
        />
      </div>
    </main>
  )
}
