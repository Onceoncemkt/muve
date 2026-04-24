import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { Rol } from '@/types'

type PerfilFlexible = {
  rol: Rol
  ciudad?: string | null
  negocio_id?: string | null
}

type NegocioConCiudad = {
  id: string
  nombre: string
  ciudad: string | null
}

type NegocioSinCiudad = {
  id: string
  nombre: string
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()

  const consultasPerfil = [
    { select: 'rol, ciudad, negocio_id', incluyeCiudad: true, incluyeNegocioId: true },
    { select: 'rol, ciudad', incluyeCiudad: true, incluyeNegocioId: false },
    { select: 'rol, negocio_id', incluyeCiudad: false, incluyeNegocioId: true },
    { select: 'rol', incluyeCiudad: false, incluyeNegocioId: false },
  ] as const

  let perfil: { rol: Rol; ciudad: string | null; negocio_id: string | null } | null = null

  for (const consulta of consultasPerfil) {
    const resultado = await db
      .from('users')
      .select(consulta.select)
      .eq('id', user.id)
      .single<PerfilFlexible>()

    if (!resultado.error && resultado.data) {
      perfil = {
        rol: resultado.data.rol,
        ciudad: consulta.incluyeCiudad && typeof resultado.data.ciudad === 'string'
          ? resultado.data.ciudad
          : null,
        negocio_id: consulta.incluyeNegocioId && typeof resultado.data.negocio_id === 'string'
          ? resultado.data.negocio_id
          : null,
      }
      break
    }

    const errorPorColumnaOpcional = (
      faltaColumna(resultado.error, 'ciudad')
      || faltaColumna(resultado.error, 'negocio_id')
    )
    if (!errorPorColumnaOpcional) break
  }

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const filtrarPorNegocio = perfil.rol === 'staff' && !!perfil.negocio_id
  const filtrarPorCiudad = perfil.rol === 'staff' && !perfil.negocio_id && !!perfil.ciudad

  const consultasNegocios = [
    { select: 'id, nombre, ciudad', incluyeCiudad: true, usaActivo: true },
    { select: 'id, nombre, ciudad', incluyeCiudad: true, usaActivo: false },
    { select: 'id, nombre', incluyeCiudad: false, usaActivo: true },
    { select: 'id, nombre', incluyeCiudad: false, usaActivo: false },
  ] as const

  let negocios: Array<{ id: string; nombre: string; ciudad: string | null }> | null = null
  let ultimoError: string | null = null

  for (const consulta of consultasNegocios) {
    let query = db
      .from('negocios')
      .select(consulta.select)

    if (consulta.usaActivo) {
      query = query.eq('activo', true)
    }

    if (filtrarPorNegocio && perfil.negocio_id) {
      query = query.eq('id', perfil.negocio_id)
    } else if (filtrarPorCiudad && perfil.ciudad && consulta.incluyeCiudad) {
      query = query.eq('ciudad', perfil.ciudad)
    }

    if (consulta.incluyeCiudad) {
      query = query.order('ciudad').order('nombre')
    } else {
      query = query.order('nombre')
    }

    const { data, error } = await query

    if (!error) {
      if (consulta.incluyeCiudad) {
        negocios = ((data ?? []) as unknown as NegocioConCiudad[]).map(negocio => ({
          id: negocio.id,
          nombre: negocio.nombre,
          ciudad: typeof negocio.ciudad === 'string' ? negocio.ciudad : null,
        }))
      } else {
        negocios = ((data ?? []) as unknown as NegocioSinCiudad[]).map(negocio => ({
          id: negocio.id,
          nombre: negocio.nombre,
          ciudad: null,
        }))
      }
      break
    }

    ultimoError = error.message ?? 'Error al cargar negocios'
    const errorPorColumnaOpcional = (
      (consulta.incluyeCiudad && faltaColumna(error, 'ciudad'))
      || (consulta.usaActivo && faltaColumna(error, 'activo'))
    )
    if (!errorPorColumnaOpcional) break
  }

  if (!negocios) {
    return NextResponse.json(
      { error: ultimoError ?? 'No se pudieron cargar negocios' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    rol: perfil.rol,
    negocios,
  })
}
