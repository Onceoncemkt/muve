import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Rol } from '@/types'

type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

type ServicioNegocioDB = {
  id: string
  negocio_id: string
  nombre: string
  precio_normal_mxn: number | null
  descripcion: string | null
  activo: boolean | null
  created_at: string | null
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function faltaRelacion(error: { message?: string } | null | undefined, relation: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
}

function normalizarTextoOpcional(value: unknown) {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
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

  if (!faltaColumna(consulta.error, 'negocio_id')) return null

  const fallback = await db
    .from('users')
    .select('rol')
    .eq('id', userId)
    .maybeSingle<{ rol: Rol }>()

  if (fallback.error || !fallback.data) return null
  return { rol: fallback.data.rol, negocio_id: null }
}

async function sincronizarServiciosIncluidosTexto(negocioId: string) {
  const db = createServiceClient()
  const { data: serviciosActivos, error: serviciosError } = await db
    .from('negocio_servicios')
    .select('nombre')
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .order('created_at', { ascending: true })
    .returns<Array<{ nombre: string }>>()

  if (serviciosError) return

  const serviciosIncluidos = (serviciosActivos ?? [])
    .map((servicio) => servicio.nombre.trim())
    .filter(Boolean)
    .join(', ')

  await db
    .from('negocios')
    .update({ servicios_incluidos: serviciosIncluidos || null })
    .eq('id', negocioId)
}

function normalizarServicio(servicio: ServicioNegocioDB) {
  return {
    id: servicio.id,
    negocio_id: servicio.negocio_id,
    nombre: servicio.nombre,
    precio_normal_mxn: typeof servicio.precio_normal_mxn === 'number'
      ? Math.max(Math.trunc(servicio.precio_normal_mxn), 0)
      : 0,
    descripcion: servicio.descripcion ?? null,
    activo: Boolean(servicio.activo),
    created_at: servicio.created_at ?? null,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as {
    nombre?: unknown
    precio_normal_mxn?: unknown
    descripcion?: unknown
    activo?: unknown
  }

  const db = createServiceClient()
  const { data: servicioActual, error: servicioError } = await db
    .from('negocio_servicios')
    .select('id, negocio_id, nombre, precio_normal_mxn, descripcion, activo, created_at')
    .eq('id', id)
    .maybeSingle<ServicioNegocioDB>()

  if (faltaRelacion(servicioError, 'negocio_servicios')) {
    return NextResponse.json(
      { error: 'Falta la tabla negocio_servicios. Ejecuta la migración 017 en Supabase.' },
      { status: 500 }
    )
  }

  if (servicioError || !servicioActual) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
  }

  if (perfil.rol === 'staff' && perfil.negocio_id && servicioActual.negocio_id !== perfil.negocio_id) {
    return NextResponse.json({ error: 'No puedes editar servicios de otro negocio' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}

  if ('nombre' in body) {
    const nombre = normalizarTextoOpcional(body.nombre)
    if (!nombre) {
      return NextResponse.json({ error: 'nombre no puede ir vacío' }, { status: 400 })
    }
    updates.nombre = nombre
  }

  if ('precio_normal_mxn' in body) {
    const precio = normalizarEnteroNoNegativo(body.precio_normal_mxn)
    if (precio === null) {
      return NextResponse.json({ error: 'precio_normal_mxn debe ser un entero mayor o igual a 0' }, { status: 400 })
    }
    updates.precio_normal_mxn = precio
  }

  if ('descripcion' in body) {
    updates.descripcion = normalizarTextoOpcional(body.descripcion)
  }

  if (typeof body.activo === 'boolean') {
    updates.activo = body.activo
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await db
    .from('negocio_servicios')
    .update(updates)
    .eq('id', id)
    .select('id, negocio_id, nombre, precio_normal_mxn, descripcion, activo, created_at')
    .maybeSingle<ServicioNegocioDB>()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo actualizar el servicio' }, { status: 500 })
  }

  void sincronizarServiciosIncluidosTexto(servicioActual.negocio_id)

  return NextResponse.json({ servicio: normalizarServicio(data) })
}
