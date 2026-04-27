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
  const normalizado = plan.trim().toLowerCase()
  if (normalizado === 'basico' || normalizado === 'básico') return 'basico'
  if (normalizado === 'plus') return 'plus'
  if (normalizado === 'total') return 'total'
  return null
}

export function planDesdePriceId(priceId: string | null | undefined): PlanMembresia | null {
  if (!priceId) return null
  return PLAN_POR_PRICE_ID[priceId] ?? null
}

export function puedeReservarConPlan(planUsuario: PlanMembresia, planRequerido: PlanMembresia) {
  return PLAN_NIVELES[planUsuario] >= PLAN_NIVELES[planRequerido]
}
