import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Rol } from '@/types'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizarCategoriaNegocio } from '@/lib/planes'

type PerfilFlexible = {
  rol: Rol
  ciudad?: string | null
  negocio_id?: string | null
}

type NegocioConCiudad = {
  id: string
  nombre: string
  ciudad: string | null
  categoria?: string | null
  monto_maximo_visita?: number | null
  servicios_incluidos?: string | null
}

type NegocioSinCiudad = {
  id: string
  nombre: string
  categoria?: string | null
  monto_maximo_visita?: number | null
  servicios_incluidos?: string | null
}


function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient()

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
    {
      select: 'id, nombre, ciudad, categoria, monto_maximo_visita, servicios_incluidos',
      incluyeCiudad: true,
      incluyeCategoria: true,
      incluyeMontoMaximo: true,
      incluyeServiciosIncluidos: true,
      usaActivo: true,
    },
    {
      select: 'id, nombre, ciudad, categoria',
      incluyeCiudad: true,
      incluyeCategoria: true,
      incluyeMontoMaximo: false,
      incluyeServiciosIncluidos: false,
      usaActivo: true,
    },
    {
      select: 'id, nombre, ciudad',
      incluyeCiudad: true,
      incluyeCategoria: false,
      incluyeMontoMaximo: false,
      incluyeServiciosIncluidos: false,
      usaActivo: true,
    },
    {
      select: 'id, nombre, categoria',
      incluyeCiudad: false,
      incluyeCategoria: true,
      incluyeMontoMaximo: false,
      incluyeServiciosIncluidos: false,
      usaActivo: true,
    },
    {
      select: 'id, nombre',
      incluyeCiudad: false,
      incluyeCategoria: false,
      incluyeMontoMaximo: false,
      incluyeServiciosIncluidos: false,
      usaActivo: true,
    },
    {
      select: 'id, nombre, ciudad, categoria, monto_maximo_visita, servicios_incluidos',
      incluyeCiudad: true,
      incluyeCategoria: true,
      incluyeMontoMaximo: true,
      incluyeServiciosIncluidos: true,
      usaActivo: false,
    },
    {
      select: 'id, nombre, ciudad, categoria',
      incluyeCiudad: true,
      incluyeCategoria: true,
      incluyeMontoMaximo: false,
      incluyeServiciosIncluidos: false,
      usaActivo: false,
    },
    {
      select: 'id, nombre',
      incluyeCiudad: false,
      incluyeCategoria: false,
      incluyeMontoMaximo: false,
      incluyeServiciosIncluidos: false,
      usaActivo: false,
    },
  ] as const
  let negocios: Array<{
    id: string
    nombre: string
    ciudad: string | null
    categoria: string | null
    monto_maximo_visita: number
    servicios_incluidos: string | null
  }> | null = null
  let ultimoError: string | null = null

  for (const consulta of consultasNegocios) {
    let query = db
      .from('negocios')
      .select(consulta.select)

    if (consulta.usaActivo) {
      query = query.or('activo.eq.true,activo.is.null')
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
      if (consulta.usaActivo && (data ?? []).length === 0) {
        continue
      }
      if (consulta.incluyeCiudad) {
        negocios = ((data ?? []) as unknown as NegocioConCiudad[]).map(negocio => ({
          id: negocio.id,
          nombre: negocio.nombre,
          ciudad: typeof negocio.ciudad === 'string' ? negocio.ciudad : null,
          categoria: consulta.incluyeCategoria
            ? normalizarCategoriaNegocio(negocio.categoria)
            : null,
          monto_maximo_visita: consulta.incluyeMontoMaximo && typeof negocio.monto_maximo_visita === 'number'
            ? Math.max(Math.trunc(negocio.monto_maximo_visita), 0)
            : 0,
          servicios_incluidos: consulta.incluyeServiciosIncluidos && typeof negocio.servicios_incluidos === 'string'
            ? negocio.servicios_incluidos
            : null,
        }))
      } else {
        negocios = ((data ?? []) as unknown as NegocioSinCiudad[]).map(negocio => ({
          id: negocio.id,
          nombre: negocio.nombre,
          ciudad: null,
          categoria: consulta.incluyeCategoria
            ? normalizarCategoriaNegocio(negocio.categoria)
            : null,
          monto_maximo_visita: consulta.incluyeMontoMaximo && typeof negocio.monto_maximo_visita === 'number'
            ? Math.max(Math.trunc(negocio.monto_maximo_visita), 0)
            : 0,
          servicios_incluidos: consulta.incluyeServiciosIncluidos && typeof negocio.servicios_incluidos === 'string'
            ? negocio.servicios_incluidos
            : null,
        }))
      }
      break
    }

    ultimoError = error.message ?? 'Error al cargar negocios'
    const errorPorColumnaOpcional = (
      (consulta.incluyeCiudad && faltaColumna(error, 'ciudad'))
      || (consulta.incluyeCategoria && faltaColumna(error, 'categoria'))
      || (consulta.incluyeMontoMaximo && faltaColumna(error, 'monto_maximo_visita'))
      || (consulta.incluyeServiciosIncluidos && faltaColumna(error, 'servicios_incluidos'))
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
