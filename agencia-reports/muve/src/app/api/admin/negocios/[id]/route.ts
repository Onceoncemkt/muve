import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Categoria, Ciudad, Rol } from '@/types'

const CIUDADES_VALIDAS: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS_VALIDAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const formData = await request.formData()
  const nextPath = resolverNextPath(formData.get('next'))

  const nombre = texto(formData.get('nombre'))
  const categoriaRaw = texto(formData.get('categoria')).toLowerCase()
  const ciudadRaw = texto(formData.get('ciudad')).toLowerCase()
  const direccion = texto(formData.get('direccion'))
  const descripcionRaw = texto(formData.get('descripcion'))
  const instagramRaw = texto(formData.get('instagram_handle'))
  const requiereReservaRaw = texto(formData.get('requiere_reserva')).toLowerCase()
  const visitasRaw = texto(formData.get('visitas_permitidas_por_mes'))

  const categoria = CATEGORIAS_VALIDAS.includes(categoriaRaw as Categoria)
    ? (categoriaRaw as Categoria)
    : null
  const ciudad = CIUDADES_VALIDAS.includes(ciudadRaw as Ciudad)
    ? (ciudadRaw as Ciudad)
    : null
  const visitas = Number.parseInt(visitasRaw, 10)

  if (!nombre || !categoria || !ciudad || !direccion || !Number.isFinite(visitas) || visitas < 1) {
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'Completa los campos requeridos antes de guardar cambios.'
    )
  }

  const instagramHandle = instagramRaw ? instagramRaw.replace(/^@+/, '') : null
  const descripcion = descripcionRaw || null
  const requiereReserva = ['true', 'on', '1', 'si', 'sí'].includes(requiereReservaRaw)

  const { data: negocioActualizado, error } = await db
    .from('negocios')
    .update({
      nombre,
      categoria,
      ciudad,
      direccion,
      descripcion,
      instagram_handle: instagramHandle,
      requiere_reserva: requiereReserva,
      visitas_permitidas_por_mes: visitas,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error || !negocioActualizado) {
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'No se pudo actualizar el negocio.'
    )
  }

  return redireccionConEstado(request, nextPath, 'ok', 'Negocio actualizado correctamente.')
}
