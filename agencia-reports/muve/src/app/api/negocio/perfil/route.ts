import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Rol } from '@/types'

type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

type NegocioPerfilDB = {
  id: string
  nombre: string
  categoria: string
  ciudad: string
  direccion?: string | null
  descripcion?: string | null
  imagen_url?: string | null
  instagram_handle?: string | null
  tiktok_handle?: string | null
  telefono_contacto?: string | null
  email_contacto?: string | null
  horario_atencion?: string | null
  stripe_account_id?: string | null
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function normalizarTextoOptional(value: unknown) {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

function normalizarHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim().replace(/^@+/, '')
  return limpio.length > 0 ? limpio : null
}

function normalizarEmailContacto(value: unknown): { valor: string | null; invalido: boolean } {
  if (typeof value !== 'string') return { valor: null, invalido: false }
  const limpio = value.trim().toLowerCase()
  if (!limpio) return { valor: null, invalido: false }
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(limpio)) return { valor: null, invalido: true }
  return { valor: limpio, invalido: false }
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

function resolverNegocioIdObjetivo({
  perfil,
  negocioIdBody,
  negocioIdQuery,
}: {
  perfil: PerfilAcceso
  negocioIdBody: string | null
  negocioIdQuery: string | null
}) {
  if (perfil.rol === 'staff') return perfil.negocio_id
  return negocioIdBody ?? negocioIdQuery ?? perfil.negocio_id
}

function normalizarNegocioPerfil(data: NegocioPerfilDB) {
  return {
    id: data.id,
    nombre: data.nombre,
    categoria: data.categoria,
    ciudad: data.ciudad,
    direccion: data.direccion ?? '',
    descripcion: data.descripcion ?? '',
    imagen_url: data.imagen_url ?? null,
    instagram_handle: data.instagram_handle ?? null,
    tiktok_handle: data.tiktok_handle ?? null,
    telefono_contacto: data.telefono_contacto ?? null,
    email_contacto: data.email_contacto ?? null,
    horario_atencion: data.horario_atencion ?? null,
    stripe_account_id: data.stripe_account_id ?? null,
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
  if (perfil.rol === 'staff' && negocioIdQuery && negocioIdQuery !== perfil.negocio_id) {
    return NextResponse.json({ error: 'No puedes consultar datos de otro negocio' }, { status: 403 })
  }

  const negocioIdObjetivo = resolverNegocioIdObjetivo({
    perfil,
    negocioIdBody: null,
    negocioIdQuery,
  })

  if (!negocioIdObjetivo) {
    return NextResponse.json({ error: 'Tu cuenta no tiene negocio asignado' }, { status: 400 })
  }

  const db = createServiceClient()
  const consultasNegocio = [
    {
      select: 'id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, tiktok_handle, telefono_contacto, email_contacto, horario_atencion, stripe_account_id',
      incluyeImagen: true,
      incluyeInstagram: true,
      incluyeTiktok: true,
      incluyeTelefono: true,
      incluyeEmail: true,
      incluyeHorario: true,
      incluyeStripe: true,
    },
    {
      select: 'id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, tiktok_handle, stripe_account_id',
      incluyeImagen: true,
      incluyeInstagram: true,
      incluyeTiktok: true,
      incluyeTelefono: false,
      incluyeEmail: false,
      incluyeHorario: false,
      incluyeStripe: true,
    },
    {
      select: 'id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, stripe_account_id',
      incluyeImagen: true,
      incluyeInstagram: true,
      incluyeTiktok: false,
      incluyeTelefono: false,
      incluyeEmail: false,
      incluyeHorario: false,
      incluyeStripe: true,
    },
    {
      select: 'id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, stripe_account_id',
      incluyeImagen: true,
      incluyeInstagram: false,
      incluyeTiktok: false,
      incluyeTelefono: false,
      incluyeEmail: false,
      incluyeHorario: false,
      incluyeStripe: true,
    },
    {
      select: 'id, nombre, categoria, ciudad, direccion, descripcion, imagen_url',
      incluyeImagen: true,
      incluyeInstagram: false,
      incluyeTiktok: false,
      incluyeTelefono: false,
      incluyeEmail: false,
      incluyeHorario: false,
      incluyeStripe: false,
    },
    {
      select: 'id, nombre, categoria, ciudad, direccion, descripcion',
      incluyeImagen: false,
      incluyeInstagram: false,
      incluyeTiktok: false,
      incluyeTelefono: false,
      incluyeEmail: false,
      incluyeHorario: false,
      incluyeStripe: false,
    },
  ] as const

  let negocio: NegocioPerfilDB | null = null
  let negocioError: { message?: string } | null = null

  for (const consulta of consultasNegocio) {
    const resultado = await db
      .from('negocios')
      .select(consulta.select)
      .eq('id', negocioIdObjetivo)
      .maybeSingle<NegocioPerfilDB>()

    if (!resultado.error && resultado.data) {
      negocio = {
        id: resultado.data.id,
        nombre: resultado.data.nombre,
        categoria: resultado.data.categoria,
        ciudad: resultado.data.ciudad,
        direccion: resultado.data.direccion ?? '',
        descripcion: resultado.data.descripcion ?? '',
        imagen_url: consulta.incluyeImagen ? (resultado.data.imagen_url ?? null) : null,
        instagram_handle: consulta.incluyeInstagram ? normalizarHandle(resultado.data.instagram_handle) : null,
        tiktok_handle: consulta.incluyeTiktok ? normalizarHandle(resultado.data.tiktok_handle) : null,
        telefono_contacto: consulta.incluyeTelefono ? (resultado.data.telefono_contacto ?? null) : null,
        email_contacto: consulta.incluyeEmail ? (resultado.data.email_contacto ?? null) : null,
        horario_atencion: consulta.incluyeHorario ? (resultado.data.horario_atencion ?? null) : null,
        stripe_account_id: consulta.incluyeStripe ? (resultado.data.stripe_account_id ?? null) : null,
      }
      negocioError = null
      break
    }

    negocioError = resultado.error
    const errorPorColumnaOpcional = (
      (consulta.incluyeImagen && faltaColumna(resultado.error, 'imagen_url'))
      || (consulta.incluyeInstagram && faltaColumna(resultado.error, 'instagram_handle'))
      || (consulta.incluyeTiktok && faltaColumna(resultado.error, 'tiktok_handle'))
      || (consulta.incluyeTelefono && faltaColumna(resultado.error, 'telefono_contacto'))
      || (consulta.incluyeEmail && faltaColumna(resultado.error, 'email_contacto'))
      || (consulta.incluyeHorario && faltaColumna(resultado.error, 'horario_atencion'))
      || (consulta.incluyeStripe && faltaColumna(resultado.error, 'stripe_account_id'))
    )
    if (!errorPorColumnaOpcional) break
  }

  if (negocioError || !negocio) {
    return NextResponse.json(
      { error: negocioError?.message ?? 'No se pudo cargar el perfil del negocio' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    negocio: normalizarNegocioPerfil(negocio),
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as {
    negocio_id?: unknown
    nombre?: unknown
    direccion?: unknown
    descripcion?: unknown
    instagram_handle?: unknown
    tiktok_handle?: unknown
    telefono_contacto?: unknown
    email_contacto?: unknown
    horario_atencion?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : null
  const negocioIdQuery = searchParams.get('negocio_id')
  if (perfil.rol === 'staff') {
    const negocioAsignado = perfil.negocio_id
    const negocioSolicitado = negocioIdBody ?? negocioIdQuery
    if (negocioSolicitado && negocioSolicitado !== negocioAsignado) {
      return NextResponse.json({ error: 'No puedes editar otro negocio' }, { status: 403 })
    }
  }

  const negocioIdObjetivo = resolverNegocioIdObjetivo({
    perfil,
    negocioIdBody,
    negocioIdQuery,
  })

  if (!negocioIdObjetivo) {
    return NextResponse.json({ error: 'negocio_id requerido' }, { status: 400 })
  }

  const payload: Record<string, string | null> = {}

  if ('nombre' in body) {
    const nombre = normalizarTextoOptional(body.nombre)
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre del negocio es obligatorio' }, { status: 400 })
    }
    payload.nombre = nombre
  }

  if ('direccion' in body) {
    const direccion = normalizarTextoOptional(body.direccion)
    if (!direccion) {
      return NextResponse.json({ error: 'La dirección del negocio es obligatoria' }, { status: 400 })
    }
    payload.direccion = direccion
  }

  if ('descripcion' in body) {
    payload.descripcion = normalizarTextoOptional(body.descripcion)
  }

  if ('instagram_handle' in body) {
    payload.instagram_handle = normalizarHandle(body.instagram_handle)
  }

  if ('tiktok_handle' in body) {
    payload.tiktok_handle = normalizarHandle(body.tiktok_handle)
  }

  if ('telefono_contacto' in body) {
    payload.telefono_contacto = normalizarTextoOptional(body.telefono_contacto)
  }

  if ('email_contacto' in body) {
    const email = normalizarEmailContacto(body.email_contacto)
    if (email.invalido) {
      return NextResponse.json({ error: 'El email de contacto no es válido' }, { status: 400 })
    }
    payload.email_contacto = email.valor
  }

  if ('horario_atencion' in body) {
    payload.horario_atencion = normalizarTextoOptional(body.horario_atencion)
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const db = createServiceClient()
  let error: { message?: string } | null = null

  for (let intento = 0; intento < 4; intento += 1) {
    const resultado = await db
      .from('negocios')
      .update(payload)
      .eq('id', negocioIdObjetivo)

    if (!resultado.error) {
      error = null
      break
    }

    error = resultado.error

    if (faltaColumna(resultado.error, 'tiktok_handle') && 'tiktok_handle' in payload) {
      delete payload.tiktok_handle
      continue
    }
    if (faltaColumna(resultado.error, 'instagram_handle') && 'instagram_handle' in payload) {
      delete payload.instagram_handle
      continue
    }
    break
  }

  if (error) {
    if (
      faltaColumna(error, 'telefono_contacto')
      || faltaColumna(error, 'email_contacto')
      || faltaColumna(error, 'horario_atencion')
    ) {
      return NextResponse.json(
        { error: 'Faltan columnas del perfil de negocio. Ejecuta la migración 025 en Supabase.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error.message ?? 'No se pudo actualizar el perfil del negocio' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    negocio: {
      id: negocioIdObjetivo,
      ...payload,
    },
  })
}
