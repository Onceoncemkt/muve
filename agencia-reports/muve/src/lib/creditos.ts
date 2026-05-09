import { CREDITOS_POR_PLAN } from '@/lib/planes'
import type { PlanMembresia } from '@/types'

export function calcularVisitasRestantes(params: {
  plan: PlanMembresia | null
  creditosExtra: number
  visitasUsadasCiclo: number
}): number {
  if (!params.plan) return 0
  const limiteVisitasMensuales = CREDITOS_POR_PLAN[params.plan] ?? 0
  const visitasDisponibles = limiteVisitasMensuales + (params.creditosExtra ?? 0)
  return Math.max(visitasDisponibles - params.visitasUsadasCiclo, 0)
}
