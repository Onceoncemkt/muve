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

function normalizarTextoRequerido(value: unknown) {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
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

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdQuery = searchParams.get('negocio_id')
  const soloActivos = searchParams.get('solo_activos') === 'true'

  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : negocioIdQuery

  if (!negocioIdObjetivo) {
    return NextResponse.json(
      { error: perfil.rol === 'staff' ? 'Tu cuenta no tiene negocio asignado' : 'negocio_id requerido' },
      { status: 400 }
    )
  }

  if (perfil.rol === 'staff' && negocioIdQuery && perfil.negocio_id && negocioIdQuery !== perfil.negocio_id) {
    return NextResponse.json({ error: 'No puedes consultar servicios de otro negocio' }, { status: 403 })
  }

  const db = createServiceClient()
  let query = db
    .from('negocio_servicios')
    .select('id, negocio_id, nombre, precio_normal_mxn, descripcion, activo, created_at')
    .eq('negocio_id', negocioIdObjetivo)
    .order('created_at', { ascending: false })

  if (soloActivos) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query.returns<ServicioNegocioDB[]>()

  if (faltaRelacion(error, 'negocio_servicios')) {
    return NextResponse.json(
      { error: 'Falta la tabla negocio_servicios. Ejecuta la migración 017 en Supabase.' },
      { status: 500 }
    )
  }

  if (error) {
    return NextResponse.json({ error: error.message ?? 'No se pudieron cargar servicios' }, { status: 500 })
  }

  return NextResponse.json({
    negocio_id: negocioIdObjetivo,
    servicios: (data ?? []).map(normalizarServicio),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    negocio_id?: unknown
    nombre?: unknown
    precio_normal_mxn?: unknown
    descripcion?: unknown
  }

  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : null
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : negocioIdBody

  if (!negocioIdObjetivo) {
    return NextResponse.json(
      { error: perfil.rol === 'staff' ? 'Tu cuenta no tiene negocio asignado' : 'negocio_id requerido' },
      { status: 400 }
    )
  }

  const nombre = normalizarTextoRequerido(body.nombre)
  const precioNormal = normalizarEnteroNoNegativo(body.precio_normal_mxn)
  const descripcion = normalizarTextoOpcional(body.descripcion)

  if (!nombre) {
    return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  }
  if (precioNormal === null) {
    return NextResponse.json({ error: 'precio_normal_mxn debe ser un entero mayor o igual a 0' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('negocio_servicios')
    .insert({
      negocio_id: negocioIdObjetivo,
      nombre,
      precio_normal_mxn: precioNormal,
      descripcion,
      activo: true,
    })
    .select('id, negocio_id, nombre, precio_normal_mxn, descripcion, activo, created_at')
    .maybeSingle<ServicioNegocioDB>()

  if (faltaRelacion(error, 'negocio_servicios')) {
    return NextResponse.json(
      { error: 'Falta la tabla negocio_servicios. Ejecuta la migración 017 en Supabase.' },
      { status: 500 }
    )
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo crear el servicio' }, { status: 500 })
  }

  void sincronizarServiciosIncluidosTexto(negocioIdObjetivo)

  return NextResponse.json({ servicio: normalizarServicio(data) }, { status: 201 })
}
