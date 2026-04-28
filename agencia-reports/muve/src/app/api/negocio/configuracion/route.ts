import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Rol } from '@/types'

type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function normalizarEnteroNoNegativo(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const entero = Math.trunc(value)
    return entero >= 0 ? entero : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

async function obtenerPerfilAcceso(userId: string): Promise<PerfilAcceso | null> {
  const db = createServiceClient()
  const consulta = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', userId)
    .maybeSingle<PerfilAcceso>()

  if (!consulta.error && consulta.data) {
    return {
      rol: consulta.data.rol,
      negocio_id: typeof consulta.data.negocio_id === 'string' ? consulta.data.negocio_id : null,
    }
  }

  if (!faltaColumna(consulta.error, 'negocio_id')) {
    return null
  }

  const fallback = await db
    .from('users')
    .select('rol')
    .eq('id', userId)
    .maybeSingle<{ rol: Rol }>()

  if (fallback.error || !fallback.data) return null

  return {
    rol: fallback.data.rol,
    negocio_id: null,
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    negocio_id?: unknown
    monto_maximo_visita?: unknown
    servicios_incluidos?: unknown
  }

  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : null
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdBody ?? null)

  if (!negocioIdObjetivo) {
    return NextResponse.json(
      { error: perfil.rol === 'staff' ? 'Tu cuenta no tiene negocio asignado' : 'negocio_id requerido' },
      { status: 400 }
    )
  }

  const incluyeMontoMaximo = Object.prototype.hasOwnProperty.call(body, 'monto_maximo_visita')
  const incluyeServiciosIncluidos = Object.prototype.hasOwnProperty.call(body, 'servicios_incluidos')

  if (!incluyeMontoMaximo && !incluyeServiciosIncluidos) {
    return NextResponse.json(
      { error: 'Debes enviar al menos monto_maximo_visita o servicios_incluidos' },
      { status: 400 }
    )
  }

  const payload: Record<string, number | string | null> = {}

  if (incluyeMontoMaximo) {
    const montoMaximoVisita = normalizarEnteroNoNegativo(body.monto_maximo_visita)
    if (montoMaximoVisita === null) {
      return NextResponse.json(
        { error: 'monto_maximo_visita debe ser un entero mayor o igual a 0' },
        { status: 400 }
      )
    }
    payload.monto_maximo_visita = montoMaximoVisita
  }

  if (incluyeServiciosIncluidos) {
    if (body.servicios_incluidos !== null && typeof body.servicios_incluidos !== 'string') {
      return NextResponse.json(
        { error: 'servicios_incluidos debe ser texto o null' },
        { status: 400 }
      )
    }
    payload.servicios_incluidos = typeof body.servicios_incluidos === 'string'
      ? body.servicios_incluidos.trim()
      : null
  }

  const db = createServiceClient()
  const payloadAActualizar: Record<string, number | string | null> = { ...payload }
  let error: { message?: string } | null = null

  for (let intento = 0; intento < 3; intento += 1) {
    if (Object.keys(payloadAActualizar).length === 0) break

    const resultado = await db
      .from('negocios')
      .update(payloadAActualizar)
      .eq('id', negocioIdObjetivo)

    if (!resultado.error) {
      error = null
      break
    }

    error = resultado.error
    if (faltaColumna(resultado.error, 'monto_maximo_visita') && 'monto_maximo_visita' in payloadAActualizar) {
      delete payloadAActualizar.monto_maximo_visita
      continue
    }
    if (faltaColumna(resultado.error, 'servicios_incluidos') && 'servicios_incluidos' in payloadAActualizar) {
      delete payloadAActualizar.servicios_incluidos
      continue
    }
    break
  }

  if (Object.keys(payloadAActualizar).length === 0) {
    return NextResponse.json(
      { error: 'Faltan columnas de configuración en negocios. Ejecuta la migración 017 en Supabase.' },
      { status: 500 }
    )
  }

  if (error) {
    return NextResponse.json({ error: error.message ?? 'No se pudo actualizar configuración de negocio' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    negocio_id: negocioIdObjetivo,
    monto_maximo_visita: typeof payloadAActualizar.monto_maximo_visita === 'number'
      ? payloadAActualizar.monto_maximo_visita
      : null,
    servicios_incluidos: typeof payloadAActualizar.servicios_incluidos === 'string'
      ? payloadAActualizar.servicios_incluidos
      : null,
  })
}
