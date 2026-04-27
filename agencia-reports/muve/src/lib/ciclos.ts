export type VentanaCiclo = {
  inicio: Date
  fin: Date
}

export function parseFechaIso(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function sumarUnMes(fecha: Date): Date {
  const out = new Date(fecha)
  out.setUTCMonth(out.getUTCMonth() + 1)
  return out
}

export function restarUnMes(fecha: Date): Date {
  const out = new Date(fecha)
  out.setUTCMonth(out.getUTCMonth() - 1)
  return out
}

export function resolverVentanaCiclo({
  fechaInicioCiclo,
  fechaFinPlan,
  referencia = new Date(),
}: {
  fechaInicioCiclo?: string | null
  fechaFinPlan?: string | null
  referencia?: Date
}): VentanaCiclo {
  let inicio = parseFechaIso(fechaInicioCiclo)
  const finPersistido = parseFechaIso(fechaFinPlan)

  if (!inicio && finPersistido) {
    inicio = restarUnMes(finPersistido)
  }

  if (!inicio) {
    inicio = new Date(referencia)
  }

  let fin = finPersistido
  if (!fin || fin.getTime() <= inicio.getTime()) {
    fin = sumarUnMes(inicio)
  }

  return { inicio, fin }
}

export function planExpirado(fechaFinPlan: string | null | undefined, referencia = new Date()) {
  const fin = parseFechaIso(fechaFinPlan)
  if (!fin) return false
  return fin.getTime() < referencia.getTime()
}
