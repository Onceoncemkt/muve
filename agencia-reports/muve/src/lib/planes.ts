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
export const PLAN_VISITAS_MENSUALES: Record<PlanMembresia, number> = {
  basico: 8,
  plus: 16,
  total: 25,
}
export const PLAN_MAX_VISITAS_POR_LUGAR: Record<PlanMembresia, number> = {
  basico: 3,
  plus: 6,
  total: 10,
}

const TARIFA_NEGOCIO_CLASES_ZONA1_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 60,
  plus: 65,
  total: 70,
}
const TARIFA_NEGOCIO_FIJA_ZONA1_POR_CATEGORIA: Record<Exclude<Categoria, 'clases'>, number> = {
  gimnasio: 40,
  estetica: 50,
  restaurante: 60,
}
const TARIFA_NEGOCIO_ZONA2_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 100,
  plus: 130,
  total: 150,
}
const TARIFA_NEGOCIO_FIJA_ZONA2_POR_CATEGORIA: Record<Exclude<Categoria, 'clases' | 'gimnasio'>, number> = {
  estetica: 150,
  restaurante: 150,
}

export const CATEGORIAS_VISIBLES_POR_PLAN: Record<PlanMembresia, Categoria[]> = {
  basico: ['clases', 'gimnasio'],
  plus: ['clases', 'gimnasio', 'estetica'],
  total: ['clases', 'gimnasio', 'estetica', 'restaurante'],
}
export const PLAN_POR_PRICE_ID: Record<string, PlanMembresia> = {
  price_1TQbbSRo19oeOodTVcnXQ6oh: 'basico',
  price_1TQbbSRo19oeOodTQkrWChOF: 'plus',
  price_1TQbbPRo19oeOodTjiy16knM: 'total',
  price_1TQbbSRo19oeOodTCxciBYe5: 'basico',
  price_1TQbbORo19oeOodTCmHnUhn9: 'plus',
  price_1TQbbORo19oeOodTLBaSGk8d: 'total',
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
  return PLAN_POR_PRICE_ID[priceId] ?? null
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
    if (!categoriaNormalizada) return { ...TARIFA_NEGOCIO_ZONA2_POR_PLAN }
    if (categoriaNormalizada === 'clases' || categoriaNormalizada === 'gimnasio') {
      return { ...TARIFA_NEGOCIO_ZONA2_POR_PLAN }
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
