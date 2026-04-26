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

  const montoMaximoVisita = normalizarEnteroNoNegativo(body.monto_maximo_visita)
  if (montoMaximoVisita === null) {
    return NextResponse.json({ error: 'monto_maximo_visita debe ser un entero mayor o igual a 0' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('negocios')
    .update({ monto_maximo_visita: montoMaximoVisita })
    .eq('id', negocioIdObjetivo)
    .select('id, monto_maximo_visita')
    .maybeSingle<{ id: string; monto_maximo_visita: number | null }>()

  if (faltaColumna(error, 'monto_maximo_visita')) {
    return NextResponse.json(
      { error: 'Falta la columna monto_maximo_visita en negocios. Ejecuta la migración 017 en Supabase.' },
      { status: 500 }
    )
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo actualizar configuración de negocio' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    negocio_id: data.id,
    monto_maximo_visita: data.monto_maximo_visita ?? 0,
  })
}
