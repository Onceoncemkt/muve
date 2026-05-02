import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Ciudad, EstadoReserva, Rol } from '@/types'

type UsuarioRelacion = {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
}

type NegocioRelacion = {
  id: string
  nombre: string
  ciudad: Ciudad
  categoria: string
  direccion: string
}

type HorarioRelacion = {
  id: string
  hora_inicio: string
  hora_fin: string
  tipo_clase: string | null
  nombre_coach: string | null
  negocio_id: string
  negocios: NegocioRelacion | NegocioRelacion[] | null
}

type ReservacionRaw = {
  id: string
  user_id: string
  horario_id: string
  fecha: string
  estado: EstadoReserva | string
  created_at: string
  servicio_nombre: string | null
  users: UsuarioRelacion | UsuarioRelacion[] | null
  horarios: HorarioRelacion | HorarioRelacion[] | null
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function normalizarRelacion<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function fechaHoraKey(fecha: string, hora: string | null | undefined) {
  return `${fecha}T${hora ?? '23:59:59'}`
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const filtroEstado = (searchParams.get('estado') ?? 'confirmada').trim()
  const filtroCiudad = (searchParams.get('ciudad') ?? '').trim()
  const filtroNegocioId = (searchParams.get('negocio_id') ?? '').trim()
  const filtroFecha = (searchParams.get('fecha') ?? '').trim()

  let selectQuery = db
    .from('reservaciones')
    .select(`
      id, user_id, horario_id, fecha, estado, created_at, servicio_nombre,
      users ( id, nombre, email, ciudad ),
      horarios!inner (
        id, hora_inicio, hora_fin, tipo_clase, nombre_coach, negocio_id,
        negocios!inner ( id, nombre, ciudad, categoria, direccion )
      )
    `)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (filtroEstado && filtroEstado !== 'todos') {
    selectQuery = selectQuery.eq('estado', filtroEstado)
  }
  if (filtroFecha) {
    selectQuery = selectQuery.eq('fecha', filtroFecha)
  }

  const { data, error } = await selectQuery.returns<ReservacionRaw[]>()
  if (error) {
    return NextResponse.json({ error: error.message ?? 'No se pudieron cargar reservaciones' }, { status: 500 })
  }

  const reservacionesNormalizadas = (data ?? []).map((item) => {
    const usuario = normalizarRelacion(item.users)
    const horario = normalizarRelacion(item.horarios)
    const negocio = normalizarRelacion(horario?.negocios)
    const tipoServicioClase = item.servicio_nombre ?? horario?.tipo_clase ?? 'Clase'

    return {
      id: item.id,
      user_id: item.user_id,
      horario_id: item.horario_id,
      fecha: item.fecha,
      estado: item.estado,
      created_at: item.created_at,
      creditos: 1,
      servicio_nombre: item.servicio_nombre,
      tipo_servicio_clase: tipoServicioClase,
      usuario: usuario ? {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        ciudad: usuario.ciudad,
      } : null,
      horario: horario ? {
        id: horario.id,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
        tipo_clase: horario.tipo_clase,
        nombre_coach: horario.nombre_coach,
      } : null,
      negocio: negocio ? {
        id: negocio.id,
        nombre: negocio.nombre,
        ciudad: negocio.ciudad,
        categoria: negocio.categoria,
        direccion: negocio.direccion,
      } : null,
    }
  })

  const reservacionesFiltradas = reservacionesNormalizadas
    .filter((item) => {
      if (filtroCiudad && item.negocio?.ciudad !== filtroCiudad) return false
      if (filtroNegocioId && item.negocio?.id !== filtroNegocioId) return false
      if (!query) return true

      const nombreUsuario = item.usuario?.nombre?.toLowerCase() ?? ''
      const nombreNegocio = item.negocio?.nombre?.toLowerCase() ?? ''
      return nombreUsuario.includes(query) || nombreNegocio.includes(query)
    })
    .sort((a, b) => fechaHoraKey(a.fecha, a.horario?.hora_inicio).localeCompare(fechaHoraKey(b.fecha, b.horario?.hora_inicio)))

  const hoy = new Date().toISOString().split('T')[0]
  const resumen = {
    total_hoy: reservacionesFiltradas.filter((item) => item.fecha === hoy).length,
    confirmadas: reservacionesFiltradas.filter((item) => item.estado === 'confirmada').length,
    no_show: reservacionesFiltradas.filter((item) => item.estado === 'no_show').length,
    canceladas: reservacionesFiltradas.filter((item) => item.estado === 'cancelada').length,
  }

  const negocios = Array.from(new Map(
    reservacionesNormalizadas
      .filter((item) => item.negocio?.id)
      .map((item) => [item.negocio!.id, item.negocio!])
  ).values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const ciudades = Array.from(new Set(
    reservacionesNormalizadas
      .map((item) => item.negocio?.ciudad)
      .filter((ciudad): ciudad is Ciudad => typeof ciudad === 'string')
  )).sort((a, b) => a.localeCompare(b, 'es'))

  return NextResponse.json({
    reservaciones: reservacionesFiltradas,
    resumen,
    filtros: {
      ciudades,
      negocios,
    },
  })
}
