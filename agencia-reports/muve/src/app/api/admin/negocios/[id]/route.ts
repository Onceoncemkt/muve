import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Categoria, Ciudad, Rol, ZonaNegocio } from '@/types'

const CIUDADES_VALIDAS: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS_VALIDAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']
const ZONAS_VALIDAS: ZonaNegocio[] = ['zona1', 'zona2']
const COLUMNAS_OPCIONALES_NEGOCIO = [
  'zona',
  'requiere_reserva',
  'capacidad_default',
  'instagram_handle',
  'imagen_url',
] as const
const BUCKET_NEGOCIOS = 'negocios'

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

function obtenerArchivoImagen(value: FormDataEntryValue | null) {
  if (!value || typeof value === 'string') return null
  if (value.size <= 0) return null
  return value
}

function nombreArchivoSeguro(nombre: string) {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return limpio || `negocio-${Date.now()}.jpg`
}

async function subirImagenNegocio(
  db: ReturnType<typeof admin>,
  archivo: File,
  negocioId: string
) {
  const nombre = nombreArchivoSeguro(archivo.name)
  const ruta = `${negocioId}/${Date.now()}-${nombre}`
  const bytes = Buffer.from(await archivo.arrayBuffer())

  const storage = db.storage.from(BUCKET_NEGOCIOS)
  const { error } = await storage.upload(ruta, bytes, {
    contentType: archivo.type || 'application/octet-stream',
    upsert: true,
  })

  if (error) {
    return { error, publicUrl: null as string | null }
  }

  const { data } = storage.getPublicUrl(ruta)
  return { error: null, publicUrl: data.publicUrl }
}

async function asegurarBucketNegocios(db: ReturnType<typeof admin>) {
  const { data: buckets, error: listError } = await db.storage.listBuckets()
  if (listError) return listError

  const existe = (buckets ?? []).some(
    (bucket) => bucket.id === BUCKET_NEGOCIOS || bucket.name === BUCKET_NEGOCIOS
  )
  if (existe) return null

  const { error: createError } = await db.storage.createBucket(BUCKET_NEGOCIOS, { public: true })
  if (!createError) return null

  const message = createError.message?.toLowerCase() ?? ''
  if (message.includes('already') || message.includes('exists') || message.includes('duplicate')) {
    return null
  }

  return createError
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
  const zonaRaw = texto(formData.get('zona')).toLowerCase()
  const direccion = texto(formData.get('direccion'))
  const descripcionRaw = texto(formData.get('descripcion'))
  const instagramRaw = texto(formData.get('instagram_handle'))
  const requiereReservaRaw = texto(formData.get('requiere_reserva')).toLowerCase()
  const capacidadDefaultRaw = texto(formData.get('capacidad_default'))
  const fotoNegocio = obtenerArchivoImagen(formData.get('foto_negocio'))

  const categoria = CATEGORIAS_VALIDAS.includes(categoriaRaw as Categoria)
    ? (categoriaRaw as Categoria)
    : null
  const ciudad = CIUDADES_VALIDAS.includes(ciudadRaw as Ciudad)
    ? (ciudadRaw as Ciudad)
    : null
  const zona = ZONAS_VALIDAS.includes(zonaRaw as ZonaNegocio)
    ? (zonaRaw as ZonaNegocio)
    : 'zona1'

  if (!nombre || !categoria || !ciudad || !direccion) {
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

  let imagenUrl: string | null = null
  if (fotoNegocio) {
    const bucketError = await asegurarBucketNegocios(db)
    if (bucketError) {
      console.error('[POST /api/admin/negocios/[id]] ensure bucket error:', bucketError.message)
      return redireccionConEstado(
        request,
        nextPath,
        'error',
        'No se pudo preparar el bucket de imágenes. Intenta de nuevo.'
      )
    }
    if (!fotoNegocio.type.startsWith('image/')) {
      return redireccionConEstado(
        request,
        nextPath,
        'error',
        'La foto del negocio debe ser una imagen válida.'
      )
    }

    const upload = await subirImagenNegocio(db, fotoNegocio, id)
    if (upload.error || !upload.publicUrl) {
      console.error('[POST /api/admin/negocios/[id]] storage upload error:', upload.error?.message)
      return redireccionConEstado(
        request,
        nextPath,
        'error',
        'No se pudo subir la foto del negocio. Intenta de nuevo.'
      )
    }

    imagenUrl = upload.publicUrl
  }

  const payload: Record<string, unknown> = {
    nombre,
    categoria,
    ciudad,
    zona,
    direccion,
    descripcion,
    instagram_handle: instagramHandle,
    requiere_reserva: requiereReserva,
    capacidad_default: capacidadDefault,
  }
  if (imagenUrl) {
    payload.imagen_url = imagenUrl
  }
  let negocioActualizado: { id: string } | null = null
  let error: { message?: string } | null = null

  for (let intento = 0; intento < 4; intento += 1) {
    const result = await db
      .from('negocios')
      .update(payload)
      .eq('id', id)
      .select('id')
      .maybeSingle<{ id: string }>()
    negocioActualizado = result.data ?? null

    if (!result.error) {
      error = null
      break
    }

    error = result.error

    if (faltanColumnasOpcionalesNegocio(result.error)) {
      const columna = columnaOpcionalFaltante(result.error)
      if (columna) {
        delete payload[columna]
        continue
      }
    }

    break
  }

  if (error || !negocioActualizado) {
    if (error) {
      console.error('[POST /api/admin/negocios/[id]] update error:', error.message)
    }
    return redireccionConEstado(
      request,
      nextPath,
      'error',
      'No se pudo actualizar el negocio.'
    )
  }

  return redireccionConEstado(request, nextPath, 'ok', 'Negocio actualizado correctamente.')
}
