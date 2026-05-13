import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { tarifaNegocioPorCheckin } from '@/lib/planes'
import type { Rol } from '@/types'

const ESTADOS_VALIDOS = ['confirmada', 'completada', 'no_show', 'cancelada'] as const
type EstadoReservacion = (typeof ESTADOS_VALIDOS)[number]

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

async function obtenerPerfilAcceso(userId: string): Promise<PerfilAcceso | null> {
  const db = createServiceClient()
  const consulta = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', userId)
    .maybeSingle<PerfilAcceso>()

  if (consulta.error || !consulta.data) return null
  return {
    rol: consulta.data.rol,
    negocio_id: typeof consulta.data.negocio_id === 'string' ? consulta.data.negocio_id : null,
  }
}

function isoFecha(d: Date) {
  return d.toISOString().slice(0, 10)
}

function rangoFechasDesdePeriodo(periodo: string, desde: string | null, hasta: string | null) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (periodo === 'hoy') {
    const f = isoFecha(hoy)
    return { desde: f, hasta: f }
  }

  if (periodo === 'semana') {
    const dia = hoy.getDay()
    const offsetLunes = (dia + 6) % 7
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - offsetLunes)
    return { desde: isoFecha(lunes), hasta: isoFecha(hoy) }
  }

  if (periodo === 'mes') {
    const primer = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return { desde: isoFecha(primer), hasta: isoFecha(hoy) }
  }

  if (periodo === 'rango') {
    return {
      desde: desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : null,
      hasta: hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : null,
    }
  }

  return { desde: null, hasta: null }
}

type HorarioJoin = {
  id: string
  hora_inicio: string
  hora_fin: string
  tipo_clase: string | null
  negocio_id: string
}

type UsuarioJoin = {
  id: string
  nombre: string
  plan: string | null
  foto_url: string | null
  lesiones: string | null
  notas_negocio: string | null
}

type ReservacionDB = {
  id: string
  fecha: string
  estado: string
  servicio_nombre: string | null
  horarios: HorarioJoin | HorarioJoin[] | null
  users: UsuarioJoin | UsuarioJoin[] | null
}

function unirAUnico<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
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
  const negocioIdParam = searchParams.get('negocio_id')
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdParam ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json({ error: 'Negocio no asignado' }, { status: 400 })
  }

  const periodo = searchParams.get('periodo') ?? 'hoy'
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')
  const estadoParam = searchParams.get('estado')
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageSizeParam = Number.parseInt(searchParams.get('page_size') ?? String(PAGE_SIZE), 10)

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0
    ? Math.min(pageSizeParam, MAX_PAGE_SIZE)
    : PAGE_SIZE
  const estado = ESTADOS_VALIDOS.includes(estadoParam as EstadoReservacion)
    ? (estadoParam as EstadoReservacion)
    : null

  const { desde, hasta } = rangoFechasDesdePeriodo(periodo, desdeParam, hastaParam)

  const db = createServiceClient()

  const negocioConsulta = await db
    .from('negocios')
    .select('id, categoria, zona, ciudad, plan_negocio')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<{
      id: string
      categoria: string | null
      zona: string | null
      ciudad: string | null
      plan_negocio: string | null
    }>()

  if (negocioConsulta.error && !faltaColumna(negocioConsulta.error, 'plan_negocio')) {
    return NextResponse.json({ error: negocioConsulta.error.message }, { status: 500 })
  }

  const negocio = negocioConsulta.data ?? {
    id: negocioIdObjetivo,
    categoria: null,
    zona: null,
    ciudad: null,
    plan_negocio: null,
  }

  const tarifaCheckin = tarifaNegocioPorCheckin({
    categoria: negocio.categoria,
    planNegocio: negocio.plan_negocio,
    zona: negocio.zona,
    ciudad: negocio.ciudad,
  })

  let query = db
    .from('reservaciones')
    .select(`
      id, fecha, estado, servicio_nombre,
      horarios:horario_id!inner ( id, hora_inicio, hora_fin, tipo_clase, negocio_id ),
      users:user_id ( id, nombre, plan, foto_url, lesiones, notas_negocio )
    `, { count: 'exact' })
    .eq('horarios.negocio_id', negocioIdObjetivo)

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (estado) query = query.eq('estado', estado)

  query = query
    .order('fecha', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const resultado = await query.returns<ReservacionDB[]>()

  if (resultado.error) {
    console.error('[GET /api/negocio/reservaciones] error:', resultado.error.message)
    return NextResponse.json({ error: resultado.error.message }, { status: 500 })
  }

  const reservaciones = (resultado.data ?? []).map(r => {
    const horario = unirAUnico(r.horarios)
    const usuario = unirAUnico(r.users)
    const completada = r.estado === 'completada'
    return {
      id: r.id,
      fecha: r.fecha,
      hora_inicio: horario?.hora_inicio ?? null,
      hora_fin: horario?.hora_fin ?? null,
      tipo_clase: horario?.tipo_clase ?? null,
      servicio_nombre: r.servicio_nombre,
      estado: r.estado,
      monto_negocio_mxn: completada ? tarifaCheckin : 0,
      usuario: usuario ? {
        id: usuario.id,
        nombre: usuario.nombre,
        plan: usuario.plan,
        foto_url: usuario.foto_url,
        tiene_lesion: Boolean(usuario.lesiones && usuario.lesiones.trim().length > 0),
        tiene_nota: Boolean(usuario.notas_negocio && usuario.notas_negocio.trim().length > 0),
      } : null,
    }
  })

  return NextResponse.json({
    reservaciones,
    total: resultado.count ?? reservaciones.length,
    page,
    page_size: pageSize,
    tarifa_checkin_mxn: tarifaCheckin,
  })
}
