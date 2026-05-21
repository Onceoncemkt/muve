import { normalizarPlan } from '@/lib/planes'

function parseBooleanSegura(value: unknown): boolean {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'number') return value === 1
  if (typeof value !== 'string') return false
  return ['true', '1', 't', 'yes', 'si'].includes(value.trim().toLowerCase())
}

export function planEstaActivo(planActivo: unknown, plan: string | null | undefined): boolean {
  return parseBooleanSegura(planActivo) && Boolean(normalizarPlan(plan ?? null))
}

export type CamposPaseWallet = {
  planLabel: string
  creditosTexto: string
  validoHasta: string
}

const CAMPOS_SIN_PLAN: CamposPaseWallet = {
  planLabel: '—',
  creditosTexto: 'Sin plan activo',
  validoHasta: '—',
}

// Devuelve los valores PLAN / CRÉDITOS / VÁLIDO HASTA del pase. Si el usuario
// no tiene membresía activa, oculta los créditos y la vigencia.
export function camposPaseWallet(params: {
  planActivo: unknown
  plan: string | null | undefined
  planLabelActivo: string
  creditosDisponibles: number
  validoHastaActivo: string
}): CamposPaseWallet {
  if (!planEstaActivo(params.planActivo, params.plan)) {
    return CAMPOS_SIN_PLAN
  }
  return {
    planLabel: params.planLabelActivo,
    creditosTexto: `${params.creditosDisponibles} disponibles`,
    validoHasta: params.validoHastaActivo,
  }
}
