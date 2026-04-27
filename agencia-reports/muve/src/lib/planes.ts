import type { Categoria, PlanMembresia } from '@/types'

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
  plus: 12,
  total: 25,
}

export const PLAN_MAX_VISITAS_POR_LUGAR: Record<PlanMembresia, number> = {
  basico: 2,
  plus: 3,
  total: 10,
}
export const TARIFA_NEGOCIO_CLASES_POR_PLAN: Record<PlanMembresia, number> = {
  basico: 60,
  plus: 65,
  total: 70,
}

export const TARIFA_NEGOCIO_FIJA_POR_CATEGORIA: Record<Exclude<Categoria, 'clases'>, number> = {
  gimnasio: 40,
  estetica: 50,
  restaurante: 60,
}

export const CATEGORIAS_VISIBLES_POR_PLAN: Record<PlanMembresia, Categoria[]> = {
  basico: ['clases', 'gimnasio'],
  plus: ['clases', 'gimnasio', 'estetica'],
  total: ['clases', 'gimnasio', 'estetica', 'restaurante'],
}

export const PLAN_POR_PRICE_ID: Record<string, PlanMembresia> = {
  price_1TPWhLRzNt1SyOBv8EYKsGGP: 'basico',
  price_1TPS4eRzNt1SyOBv47steWqz: 'plus',
  price_1TPWhgRzNt1SyOBvrA0F50v1: 'total',
  price_1TPwv9RzNt1SyOBvJZIhqZKT: 'basico',
  price_1TPwxRRzNt1SyOBvIxIRS4sM: 'plus',
  price_1TPwyuRzNt1SyOBv5lQXhhLS: 'total',
}

export function normalizarPlan(plan: unknown): PlanMembresia | null {
  if (typeof plan !== 'string') return null
  const normalizado = plan
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  const normalizada = categoria
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalizada) return null
  if (normalizada.includes('gimnasio')) return 'gimnasio'
  if (normalizada.includes('estetica') || normalizada.includes('wellness')) return 'estetica'
  if (normalizada.includes('restaurante')) return 'restaurante'
  if (normalizada.includes('clases') || normalizada.includes('clase')) return 'clases'
  return null
}

export function obtenerTarifasNegocioPorPlan(categoria: unknown): Record<PlanMembresia, number> {
  const categoriaNormalizada = normalizarCategoriaNegocio(categoria)

  if (!categoriaNormalizada || categoriaNormalizada === 'clases') {
    return { ...TARIFA_NEGOCIO_CLASES_POR_PLAN }
  }

  const tarifaFija = TARIFA_NEGOCIO_FIJA_POR_CATEGORIA[categoriaNormalizada]
  return {
    basico: tarifaFija,
    plus: tarifaFija,
    total: tarifaFija,
  }
}

export function calcularMontoNegocioPorVisita({
  categoria,
  planUsuario,
}: {
  categoria: unknown
  planUsuario: PlanMembresia | null | undefined
}) {
  const plan = planUsuario ?? 'basico'
  const tarifas = obtenerTarifasNegocioPorPlan(categoria)
  return tarifas[plan]
}
