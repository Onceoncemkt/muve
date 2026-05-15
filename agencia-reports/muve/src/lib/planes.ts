import type { Categoria, Ciudad, PlanMembresia, ZonaNegocio } from '@/types'

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
export type RegionPrecios = 'zona1' | 'zona1_5' | 'zona2'

export const PRECIOS_MEMBRESIA_POR_REGION: Record<RegionPrecios, Record<PlanMembresia, number>> = {
  zona1: {
    basico: 649,
    plus: 1299,
    total: 1999,
  },
  zona1_5: {
    basico: 1060,
    plus: 2210,
    total: 3590,
  },
  zona2: {
    basico: 1380,
    plus: 2720,
    total: 4499,
  },
}
export const PRECIOS_ANTERIORES_MEMBRESIA_POR_REGION: Record<RegionPrecios, Partial<Record<PlanMembresia, number>>> = {
  zona1: {
    basico: 749,
    plus: 1499,
    total: 2349,
  },
  zona1_5: {
    basico: 1250,
    plus: 2600,
    total: 4225,
  },
  zona2: {
    basico: 1899,
    plus: 3749,
    total: 5799,
  },
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
const TARIFA_NEGOCIO_CLASES_ZONA1_5_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 120,
  plus: 125,
  total: 130,
}
const TARIFA_NEGOCIO_FIJA_ZONA1_5_POR_CATEGORIA: Record<Exclude<Categoria, 'clases'>, number> = {
  gimnasio: 50,
  estetica: 85,
  restaurante: 85,
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
export type StripePriceIdsPorRegion = Record<RegionPrecios, Record<PlanMembresia, string>>
type StripePriceEnvKeysPorRegion = Record<RegionPrecios, Record<PlanMembresia, string[]>>

const STRIPE_PRICE_ENV_POR_REGION: StripePriceEnvKeysPorRegion = {
  zona1: {
    basico: ['STRIPE_PRICE_ID_BASICO', 'STRIPE_PRICE_ID_MUVET_BASICO'],
    plus: ['STRIPE_PRICE_ID_PLUS', 'STRIPE_PRICE_ID_MUVET_PLUS'],
    total: ['STRIPE_PRICE_ID_TOTAL', 'STRIPE_PRICE_ID_MUVET_TOTAL'],
  },
  zona1_5: {
    basico: ['STRIPE_PRICE_ID_BASICO_Z15'],
    plus: ['STRIPE_PRICE_ID_PLUS_Z15'],
    total: ['STRIPE_PRICE_ID_TOTAL_Z15'],
  },
  zona2: {
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
export function esCiudadZona15(ciudad: unknown): boolean {
  const ciudadNormalizada = normalizarCiudadTexto(ciudad)
  return ciudadNormalizada ? CIUDADES_ZONA_1_5.has(ciudadNormalizada) : false
}
export function esCiudadZona2(ciudad: unknown): boolean {
  const ciudadNormalizada = normalizarCiudadTexto(ciudad)
  return ciudadNormalizada ? CIUDADES_ZONA_2.has(ciudadNormalizada) : false
}
function obtenerEnvStripePriceIds(envKeys: string[]) {
  const values = envKeys
    .map((envKey) => process.env[envKey]?.trim())
    .filter((value): value is string => Boolean(value))
  return Array.from(new Set(values))
}

function obtenerStripePriceIdsParcialesDesdeEnv() {
  const resultado: Record<RegionPrecios, Partial<Record<PlanMembresia, string>>> = {
    zona1: {},
    zona1_5: {},
    zona2: {},
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
    zona1: {
      basico: priceIdsParciales.zona1.basico as string,
      plus: priceIdsParciales.zona1.plus as string,
      total: priceIdsParciales.zona1.total as string,
    },
    zona1_5: {
      basico: priceIdsParciales.zona1_5.basico as string,
      plus: priceIdsParciales.zona1_5.plus as string,
      total: priceIdsParciales.zona1_5.total as string,
    },
    zona2: {
      basico: priceIdsParciales.zona2.basico as string,
      plus: priceIdsParciales.zona2.plus as string,
      total: priceIdsParciales.zona2.total as string,
    },
  }
}
export function obtenerStripePriceIdsCandidatos(region: RegionPrecios, plan: PlanMembresia): string[] {
  const envKeys = STRIPE_PRICE_ENV_POR_REGION[region][plan]
  return obtenerEnvStripePriceIds(envKeys)
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
      priceIdsParciales.zona1.basico,
      priceIdsParciales.zona1_5.basico,
      priceIdsParciales.zona2.basico,
    ],
    plus: [
      priceIdsParciales.zona1.plus,
      priceIdsParciales.zona1_5.plus,
      priceIdsParciales.zona2.plus,
    ],
    total: [
      priceIdsParciales.zona1.total,
      priceIdsParciales.zona1_5.total,
      priceIdsParciales.zona2.total,
    ],
  }
  for (const [plan, priceIds] of Object.entries(priceIdsConfiguradosPorPlan) as Array<[PlanMembresia, Array<string | undefined>]>) {
    if (priceIds.includes(priceId)) return plan
  }
  return null
}
export function priceIdDesdePlanYCiudad(plan: 'basico' | 'plus' | 'total', ciudad: Ciudad): string | null {
  const region = regionPreciosPorCiudad(ciudad)
  const priceIds = obtenerStripePriceIdsPorRegion()
  const priceId = priceIds[region]?.[plan]
  if (!priceId) {
    console.error('[priceIdDesdePlanYCiudad] no se encontró priceId para', { plan, ciudad, region })
    return null
  }
  return priceId
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

const CIUDADES_ZONA_1 = new Set<Ciudad>(['tulancingo', 'pachuca'])
const CIUDADES_ZONA_1_5 = new Set<Ciudad>(['ensenada', 'tecate'])
const CIUDADES_ZONA_2 = new Set<Ciudad>(['tijuana'])

function normalizarCiudadTexto(ciudad: unknown): Ciudad | null {
  if (typeof ciudad !== 'string') return null
  const ciudadNormalizada = ciudad.trim().toLowerCase()
  if (
    ciudadNormalizada === 'tulancingo'
    || ciudadNormalizada === 'pachuca'
    || ciudadNormalizada === 'ensenada'
    || ciudadNormalizada === 'tijuana'
    || ciudadNormalizada === 'tecate'
  ) {
    return ciudadNormalizada as Ciudad
  }
  return null
}
export function normalizarZonaNegocio(zona: unknown): ZonaNegocio | null {
  if (typeof zona !== 'string') return null
  const normalizada = zona.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalizada) return null
  if (normalizada === 'zona1') return 'zona1'
  if (normalizada === 'zona1.5' || normalizada === 'zona1_5' || normalizada === 'zona15') return 'zona1_5'
  if (normalizada === 'zona2') return 'zona2'
  return null
}
export function esCiudadBC(ciudad: unknown): boolean {
  return esCiudadZona15(ciudad) || esCiudadZona2(ciudad)
}
export function zonaPorCiudad(ciudad: unknown): ZonaNegocio {
  const ciudadNormalizada = normalizarCiudadTexto(ciudad)
  if (!ciudadNormalizada) return 'zona1'
  if (CIUDADES_ZONA_2.has(ciudadNormalizada)) return 'zona2'
  if (CIUDADES_ZONA_1_5.has(ciudadNormalizada)) return 'zona1_5'
  if (CIUDADES_ZONA_1.has(ciudadNormalizada)) return 'zona1'
  return 'zona1'
}
export function regionPreciosPorCiudad(ciudad: unknown): RegionPrecios {
  return zonaPorCiudad(ciudad)
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
  if (zonaNormalizada === 'zona1_5') {
    if (!categoriaNormalizada) return { ...TARIFA_NEGOCIO_CLASES_ZONA1_5_POR_PLAN }
    if (categoriaNormalizada === 'clases') {
      return { ...TARIFA_NEGOCIO_CLASES_ZONA1_5_POR_PLAN }
    }
    const tarifaFijaZona15 = TARIFA_NEGOCIO_FIJA_ZONA1_5_POR_CATEGORIA[categoriaNormalizada]
    return { basico: tarifaFijaZona15, plus: tarifaFijaZona15, total: tarifaFijaZona15 }
  }

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

export function tarifaNegocioPorCheckin({
  categoria,
  planNegocio,
  zona,
  ciudad,
}: {
  categoria: unknown
  planNegocio: unknown
  zona?: unknown
  ciudad?: unknown
}): number {
  const plan: PlanMembresia = planNegocio === 'plus' || planNegocio === 'total'
    ? planNegocio
    : 'basico'
  const zonaNegocio = resolverZonaNegocio({ zona, ciudad })
  const tarifas = obtenerTarifasNegocioPorPlan(categoria, zonaNegocio)
  return tarifas[plan]
}
