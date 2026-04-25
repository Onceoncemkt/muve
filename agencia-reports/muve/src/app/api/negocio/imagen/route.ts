import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Rol } from '@/types'

const BUCKET_NEGOCIOS = 'negocios'

type Perfil = {
  rol: Rol
  negocio_id: string | null
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

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: perfil } = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<Perfil>()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const formData = await request.formData()
  const negocioIdBody = formData.get('negocio_id')
  const negocioId = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (typeof negocioIdBody === 'string' && negocioIdBody ? negocioIdBody : perfil.negocio_id)

  if (!negocioId) {
    return NextResponse.json({ error: 'negocio_id requerido' }, { status: 400 })
  }

  const fotoNegocio = obtenerArchivoImagen(formData.get('foto_negocio'))
  if (!fotoNegocio) {
    return NextResponse.json({ error: 'Selecciona una imagen para subir' }, { status: 400 })
  }

  if (!fotoNegocio.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen válida' }, { status: 400 })
  }

  const nombre = nombreArchivoSeguro(fotoNegocio.name)
  const ruta = `${negocioId}/${Date.now()}-${nombre}`
  const bytes = Buffer.from(await fotoNegocio.arrayBuffer())

  const storage = db.storage.from(BUCKET_NEGOCIOS)
  const { error: uploadError } = await storage.upload(ruta, bytes, {
    contentType: fotoNegocio.type || 'application/octet-stream',
    upsert: true,
  })

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message ?? 'No se pudo subir la imagen' },
      { status: 500 }
    )
  }

  const { data } = storage.getPublicUrl(ruta)
  const imagenUrl = data.publicUrl

  const update = await db
    .from('negocios')
    .update({ imagen_url: imagenUrl })
    .eq('id', negocioId)

  if (update.error) {
    if (faltaColumna(update.error, 'imagen_url')) {
      return NextResponse.json(
        { error: 'La columna imagen_url no existe aún. Ejecuta las migraciones pendientes.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: update.error.message ?? 'No se pudo guardar la imagen del negocio' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    negocio: {
      id: negocioId,
      imagen_url: imagenUrl,
    },
  })
}
