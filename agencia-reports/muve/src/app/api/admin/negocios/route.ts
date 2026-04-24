import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Categoria, Ciudad, Rol } from '@/types'

const CIUDADES_VALIDAS: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS_VALIDAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']
const COLUMNAS_OPCIONALES_NEGOCIO = [
  'requiere_reserva',
  'capacidad_default',
  'instagram_handle',
  'visitas_permitidas_por_mes',
] as const

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function resolverNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/admin'
  return value.startsWith('/admin') ? value : '/admin'
}

function texto(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function redireccionConEstado(
  request: NextRequest,
  nextPath: string,
  estado: 'ok' | 'error',
  mensaje: string
) {
  const url = new URL(nextPath, request.url)
  url.searchParams.set('negocio_status', estado)
  url.searchParams.set('negocio_msg', mensaje)
  return NextResponse.redirect(url, 303)
}

function faltanColumnasOpcionalesNegocio(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column')
    && COLUMNAS_OPCIONALES_NEGOCIO.some(columna => message.includes(columna))
}

function columnaOpcionalFaltante(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  if (!message.includes('column')) return null
  return COLUMNAS_OPCIONALES_NEGOCIO.find(columna => message.includes(columna)) ?? null
}

function requiereValorVisitasPorMes(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('visitas_permitidas_por_mes') && message.includes('null value')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const formData = await request.formData()
  const nextPath = resolverNextPath(formData.get('next'))

  const nombre = texto(formData.get('nombre'))
  const categoriaRaw = texto(formData.get('categoria')).toLowerCase()
  const ciudadRaw = texto(formData.get('ciudad')).toLowerCase()
  const direccion = texto(formData.get('direccion'))
  const descripcionRaw = texto(formData.get('descripcion'))
  const instagramRaw = texto(formData.get('instagram_handle'))
  const requiereReservaRaw = texto(formData.get('requiere_reserva')).toLowerCase()
  const capacidadDefaultRaw = texto(formData.get('capacidad_default'))

  const categoria = CATEGORIAS_VALIDAS.includes(categoriaRaw as Categoria)
    ? (categoriaRaw as Categoria)
    : null
  const ciudad = CIUDADES_VALIDAS.includes(ciudadRaw as Ciudad)
    ? (ciudadRaw as Ciudad)
    : null

  if (!nombre || !categoria || !ciudad || !direccion) {
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'Completa los campos requeridos para agregar el negocio.'
    )
  }

  const instagramHandle = instagramRaw ? instagramRaw.replace(/^@+/, '') : null
  const descripcion = descripcionRaw || null
  const requiereReserva = ['true', 'on', '1', 'si', 'sí'].includes(requiereReservaRaw)
  const capacidadDefaultParsed = Number.parseInt(capacidadDefaultRaw, 10)
  const capacidadDefault = requiereReserva
    ? (Number.isFinite(capacidadDefaultParsed) && capacidadDefaultParsed > 0 ? capacidadDefaultParsed : null)
    : null

  if (requiereReserva && !capacidadDefault) {
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'Captura una capacidad por clase válida.'
    )
  }

  const payload: Record<string, unknown> = {
    nombre,
    categoria,
    ciudad,
    direccion,
    descripcion,
    instagram_handle: instagramHandle,
    requiere_reserva: requiereReserva,
    capacidad_default: capacidadDefault,
    visitas_permitidas_por_mes: 8,
    activo: true,
  }

  let error: { message?: string } | null = null

  for (let intento = 0; intento < 6; intento += 1) {
    const result = await db
      .from('negocios')
      .insert(payload)

    if (!result.error) {
      error = null
      break
    }

    error = result.error

    if (requiereValorVisitasPorMes(result.error)) {
      payload.visitas_permitidas_por_mes = 8
      continue
    }

    if (faltanColumnasOpcionalesNegocio(result.error)) {
      const columna = columnaOpcionalFaltante(result.error)
      if (columna) {
        delete payload[columna]
        continue
      }
    }

    break
  }

  if (error) {
    console.error('[POST /api/admin/negocios] insert error:', error.message)
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'No se pudo agregar el negocio. Intenta de nuevo.'
    )
  }

  return redireccionConEstado(request, nextPath, 'ok', 'Negocio agregado correctamente.')
}
