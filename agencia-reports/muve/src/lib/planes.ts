import type { Categoria, PlanMembresia, ZonaNegocio } from '@/types'

export const PLAN_LABELS: Record<PlanMembresia, string> = {
  basico: 'BÁSICO',
  plus: 'PLUS',
  total: 'TOTAL',
}
export const PLAN_NIVELES: Record<PlanMembresia, number> = {
  basico: 1,
  plus: 2,
  total: 3,
}
export const CREDITOS_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 8,
  plus: 16,
  total: 25,
}
export const MAX_VISITAS_POR_LUGAR: Record<PlanMembresia, number> = {
  basico: 3,
  plus: 6,
  total: 10,
}
export const PLAN_VISITAS_MENSUALES = CREDITOS_POR_PLAN
export const PLAN_MAX_VISITAS_POR_LUGAR = MAX_VISITAS_POR_LUGAR

const TARIFA_NEGOCIO_CLASES_ZONA1_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 60,
  plus: 65,
  total: 70,
}
const TARIFA_NEGOCIO_FIJA_ZONA1_POR_CATEGORIA: Record<Exclude<Categoria, 'clases'>, number> = {
  gimnasio: 40,
  estetica: 60,
  restaurante: 60,
}
const TARIFA_NEGOCIO_CLASES_ZONA2_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 100,
  plus: 130,
  total: 150,
}
const TARIFA_NEGOCIO_FIJA_ZONA2_POR_CATEGORIA: Record<Exclude<Categoria, 'clases'>, number> = {
  gimnasio: 80,
  estetica: 150,
  restaurante: 150,
}

export const CATEGORIAS_VISIBLES_POR_PLAN: Record<PlanMembresia, Categoria[]> = {
  basico: ['clases', 'gimnasio'],
  plus: ['clases', 'gimnasio', 'estetica'],
  total: ['clases', 'gimnasio', 'estetica', 'restaurante'],
}
export type RegionPrecios = 'centro' | 'bc'
export type StripePriceIdsPorRegion = Record<RegionPrecios, Record<PlanMembresia, string>>
type StripePriceEnvKeysPorRegion = Record<RegionPrecios, Record<PlanMembresia, string[]>>

const STRIPE_PRICE_ENV_POR_REGION: StripePriceEnvKeysPorRegion = {
  centro: {
    basico: ['STRIPE_PRICE_ID_BASICO', 'STRIPE_PRICE_ID_MUVET_BASICO'],
    plus: ['STRIPE_PRICE_ID_PLUS', 'STRIPE_PRICE_ID_MUVET_PLUS'],
    total: ['STRIPE_PRICE_ID_TOTAL', 'STRIPE_PRICE_ID_MUVET_TOTAL'],
  },
  bc: {
    basico: ['STRIPE_PRICE_ID_BASICO_BC', 'STRIPE_PRICE_ID_MUVET_TJ_BASICO'],
    plus: ['STRIPE_PRICE_ID_PLUS_BC', 'STRIPE_PRICE_ID_MUVET_TJ_PLUS', 'STRIPE_PRICE_ID_MUVET_TJ_PLUS_'],
    total: ['STRIPE_PRICE_ID_TOTAL_BC', 'STRIPE_PRICE_ID_MUVET_TJ_TOTAL'],
  },
}

function obtenerEnvStripePriceId(envKeys: string[]) {
  for (const envKey of envKeys) {
    const value = process.env[envKey]?.trim()
    if (value) return value
  }
  return null
}

function obtenerStripePriceIdsParcialesDesdeEnv() {
  const resultado: Record<RegionPrecios, Partial<Record<PlanMembresia, string>>> = {
    centro: {},
    bc: {},
  }

  for (const [region, envPorPlan] of Object.entries(STRIPE_PRICE_ENV_POR_REGION) as Array<[RegionPrecios, Record<PlanMembresia, string[]>]>) {
    for (const [plan, envKeys] of Object.entries(envPorPlan) as Array<[PlanMembresia, string[]]>) {
      const value = obtenerEnvStripePriceId(envKeys)
      if (value) resultado[region][plan] = value
    }
  }

  return resultado
}

export function obtenerStripePriceIdsPorRegion(): StripePriceIdsPorRegion {
  const priceIdsParciales = obtenerStripePriceIdsParcialesDesdeEnv()
  const faltantes: string[] = []
  for (const [region, envPorPlan] of Object.entries(STRIPE_PRICE_ENV_POR_REGION) as Array<[RegionPrecios, Record<PlanMembresia, string[]>]>) {
    for (const [plan, envKeys] of Object.entries(envPorPlan) as Array<[PlanMembresia, string[]]>) {
      if (!priceIdsParciales[region][plan]) faltantes.push(envKeys[0])
    }
  }

  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno de Stripe Price IDs: ${faltantes.join(', ')}`)
  }

  return {
    centro: {
      basico: priceIdsParciales.centro.basico as string,
      plus: priceIdsParciales.centro.plus as string,
      total: priceIdsParciales.centro.total as string,
    },
    bc: {
      basico: priceIdsParciales.bc.basico as string,
      plus: priceIdsParciales.bc.plus as string,
      total: priceIdsParciales.bc.total as string,
    },
  }
}

export function normalizarPlan(plan: unknown): PlanMembresia | null {
  if (typeof plan !== 'string') return null
  const normalizado = plan.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!normalizado) return null
  if (normalizado === 'basico' || normalizado.includes('basico')) return 'basico'
  if (normalizado === 'plus' || normalizado.includes('plus')) return 'plus'
  if (normalizado === 'total' || normalizado.includes('total')) return 'total'
  return null
}
export function planDesdePriceId(priceId: string | null | undefined): PlanMembresia | null {
  if (!priceId) return null
  const priceIdsParciales = obtenerStripePriceIdsParcialesDesdeEnv()
  const priceIdsConfiguradosPorPlan: Record<PlanMembresia, Array<string | undefined>> = {
    basico: [
      priceIdsParciales.centro.basico,
      priceIdsParciales.bc.basico,
    ],
    plus: [
      priceIdsParciales.centro.plus,
      priceIdsParciales.bc.plus,
    ],
    total: [
      priceIdsParciales.centro.total,
      priceIdsParciales.bc.total,
    ],
  }
  for (const [plan, priceIds] of Object.entries(priceIdsConfiguradosPorPlan) as Array<[PlanMembresia, Array<string | undefined>]>) {
    if (priceIds.includes(priceId)) return plan
  }
  return null
}
export function puedeReservarConPlan(planUsuario: PlanMembresia, planRequerido: PlanMembresia) {
  return PLAN_NIVELES[planUsuario] >= PLAN_NIVELES[planRequerido]
}
export function normalizarCategoriaNegocio(categoria: unknown): Categoria | null {
  if (typeof categoria !== 'string') return null
  const normalizada = categoria.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!normalizada) return null
  if (normalizada.includes('gimnasio')) return 'gimnasio'
  if (normalizada.includes('estetica') || normalizada.includes('wellness')) return 'estetica'
  if (normalizada.includes('restaurante')) return 'restaurante'
  if (normalizada.includes('clases') || normalizada.includes('clase')) return 'clases'
  return null
}
export function normalizarZonaNegocio(zona: unknown): ZonaNegocio | null {
  if (typeof zona !== 'string') return null
  const normalizada = zona.trim().toLowerCase()
  if (!normalizada) return null
  if (normalizada === 'zona1' || normalizada === 'zona 1') return 'zona1'
  if (normalizada === 'zona2' || normalizada === 'zona 2') return 'zona2'
  return null
}
export function zonaPorCiudad(ciudad: unknown): ZonaNegocio {
  const ciudadNormalizada = typeof ciudad === 'string' ? ciudad.trim().toLowerCase() : ''
  return ciudadNormalizada === 'tijuana' ? 'zona2' : 'zona1'
}
export function resolverZonaNegocio({ zona, ciudad }: { zona?: unknown; ciudad?: unknown }): ZonaNegocio {
  return normalizarZonaNegocio(zona) ?? zonaPorCiudad(ciudad)
}
export function obtenerTarifasNegocioPorPlan(
  categoria: unknown,
  zona: unknown = 'zona1'
): Record<PlanMembresia, number> {
  const categoriaNormalizada = normalizarCategoriaNegocio(categoria)
  const zonaNormalizada = normalizarZonaNegocio(zona) ?? 'zona1'

  if (zonaNormalizada === 'zona2') {
    if (!categoriaNormalizada) return { ...TARIFA_NEGOCIO_CLASES_ZONA2_POR_PLAN }
    if (categoriaNormalizada === 'clases') {
      return { ...TARIFA_NEGOCIO_CLASES_ZONA2_POR_PLAN }
    }
    const tarifaFijaZona2 = TARIFA_NEGOCIO_FIJA_ZONA2_POR_CATEGORIA[categoriaNormalizada]
    return { basico: tarifaFijaZona2, plus: tarifaFijaZona2, total: tarifaFijaZona2 }
  }

  if (!categoriaNormalizada || categoriaNormalizada === 'clases') {
    return { ...TARIFA_NEGOCIO_CLASES_ZONA1_POR_PLAN }
  }
  const tarifaFija = TARIFA_NEGOCIO_FIJA_ZONA1_POR_CATEGORIA[categoriaNormalizada]
  return { basico: tarifaFija, plus: tarifaFija, total: tarifaFija }
}
export function calcularMontoNegocioPorVisita({
  categoria,
  planUsuario,
  zona,
  ciudad,
}: {
  categoria: unknown
  planUsuario: PlanMembresia | null | undefined
  zona?: unknown
  ciudad?: unknown
}) {
  const plan = planUsuario ?? 'basico'
  const zonaNegocio = resolverZonaNegocio({ zona, ciudad })
  const tarifas = obtenerTarifasNegocioPorPlan(categoria, zonaNegocio)
  return tarifas[plan]
}
