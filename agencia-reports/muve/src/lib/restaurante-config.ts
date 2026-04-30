import type { DiaSemana } from '@/types'

export type ConfiguracionRestaurante = {
  servicio: string
  dias_activos: DiaSemana[]
  fecha_oferta: string | null
}

export const DIAS_SEMANA_RESTAURANTE: DiaSemana[] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
]

export const RESTAURANTE_CONFIG_PREFIX = '__MUVET_RESTAURANTE_CONFIG__'

export function normalizarDiasActivosRestaurante(value: unknown): DiaSemana[] {
  if (!Array.isArray(value)) return [...DIAS_SEMANA_RESTAURANTE]
  const resultado = value.filter((dia): dia is DiaSemana => (
    typeof dia === 'string' && DIAS_SEMANA_RESTAURANTE.includes(dia as DiaSemana)
  ))
  return resultado.length > 0 ? Array.from(new Set(resultado)) : [...DIAS_SEMANA_RESTAURANTE]
}

function normalizarFechaOferta(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) return null
  const parsed = new Date(`${limpio}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : limpio
}

export function configuracionRestauranteInicial(): ConfiguracionRestaurante {
  return {
    servicio: '',
    dias_activos: [...DIAS_SEMANA_RESTAURANTE],
    fecha_oferta: null,
  }
}

export function parseConfiguracionRestaurante(raw: string | null | undefined): ConfiguracionRestaurante {
  if (typeof raw !== 'string' || !raw.trim()) return configuracionRestauranteInicial()
  const limpio = raw.trim()
  const prefijo = `${RESTAURANTE_CONFIG_PREFIX}:`
  if (!limpio.startsWith(prefijo)) {
    return {
      servicio: limpio,
      dias_activos: [...DIAS_SEMANA_RESTAURANTE],
      fecha_oferta: null,
    }
  }

  const payload = limpio.slice(prefijo.length).trim()
  if (!payload) return configuracionRestauranteInicial()

  try {
    const parsed = JSON.parse(payload) as {
      servicio?: unknown
      oferta?: unknown
      dias_activos?: unknown
      fecha_oferta?: unknown
      fecha?: unknown
    }
    return {
      servicio: typeof parsed.servicio === 'string'
        ? parsed.servicio.trim()
        : (typeof parsed.oferta === 'string' ? parsed.oferta.trim() : ''),
      dias_activos: normalizarDiasActivosRestaurante(parsed.dias_activos),
      fecha_oferta: normalizarFechaOferta(parsed.fecha_oferta ?? parsed.fecha),
    }
  } catch {
    return {
      servicio: payload,
      dias_activos: [...DIAS_SEMANA_RESTAURANTE],
      fecha_oferta: null,
    }
  }
}

export function serializarConfiguracionRestaurante(config: ConfiguracionRestaurante): string | null {
  const servicio = config.servicio.trim()
  const fecha_oferta = normalizarFechaOferta(config.fecha_oferta)
  if (!servicio && !fecha_oferta) return null
  return `${RESTAURANTE_CONFIG_PREFIX}:${JSON.stringify({
    servicio,
    dias_activos: normalizarDiasActivosRestaurante(config.dias_activos),
    fecha_oferta,
  })}`
}
