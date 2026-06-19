import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Rol } from '@/types'

const PAGE_SIZE = 20

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function diaDe(fecha: string | null | undefined): string {
  return typeof fecha === 'string' ? fecha.slice(0, 10) : ''
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const pageParam = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  // 1) Todas las reservaciones del usuario (para resumen + paginación), recientes primero.
  const { data: reservas, error: reservasError } = await db
    .from('reservaciones')
    .select('fecha, estado, horario_id, servicio_nombre, created_at')
    .eq('user_id', id)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<{
      fecha: string
      estado: string
      horario_id: string | null
      servicio_nombre: string | null
      created_at: string | null
    }[]>()

  if (reservasError) {
    return NextResponse.json({ error: reservasError.message ?? 'No se pudo cargar el historial' }, { status: 500 })
  }

  const reservaciones = reservas ?? []

  // 2) Horarios y negocios relacionados.
  const horarioIds = [...new Set(reservaciones.map(r => r.horario_id).filter((v): v is string => Boolean(v)))]
  const horariosPorId = new Map<string, { hora_inicio: string | null; tipo_clase: string | null; tipo_servicio: string | null; negocio_id: string | null }>()
  if (horarioIds.length > 0) {
    const { data: horarios } = await db
      .from('horarios')
      .select('id, hora_inicio, tipo_clase, tipo_servicio, negocio_id')
      .in('id', horarioIds)
    for (const h of horarios ?? []) {
      horariosPorId.set(h.id as string, {
        hora_inicio: (h.hora_inicio as string) ?? null,
        tipo_clase: (h.tipo_clase as string) ?? null,
        tipo_servicio: (h.tipo_servicio as string) ?? null,
        negocio_id: (h.negocio_id as string) ?? null,
      })
    }
  }

  const negocioIds = [...new Set([...horariosPorId.values()].map(h => h.negocio_id).filter((v): v is string => Boolean(v)))]
  const negocioNombrePorId = new Map<string, string>()
  if (negocioIds.length > 0) {
    const { data: negocios } = await db
      .from('negocios')
      .select('id, nombre')
      .in('id', negocioIds)
    for (const n of negocios ?? []) negocioNombrePorId.set(n.id as string, (n.nombre as string) ?? '')
  }

  // 3) Visitas del usuario, agrupadas por (negocio_id | fecha) para emparejar por fecha.
  const { data: visitas } = await db
    .from('visitas')
    .select('fecha, negocio_id, monto_negocio, validado_por, estado')
    .eq('user_id', id)
    .returns<{ fecha: string; negocio_id: string; monto_negocio: number | null; validado_por: string | null; estado: string | null }[]>()

  const visitasPorClave = new Map<string, { monto_negocio: number | null; validado_por: string | null; estado: string | null }[]>()
  for (const v of visitas ?? []) {
    const clave = `${v.negocio_id}|${diaDe(v.fecha)}`
    const lista = visitasPorClave.get(clave) ?? []
    lista.push({ monto_negocio: v.monto_negocio, validado_por: v.validado_por, estado: v.estado })
    visitasPorClave.set(clave, lista)
  }

  // 4) Ensamblar items (en el mismo orden recientes-primero).
  const items = reservaciones.map((r) => {
    const horario = r.horario_id ? horariosPorId.get(r.horario_id) : undefined
    const negocioId = horario?.negocio_id ?? null
    const negocio = negocioId ? (negocioNombrePorId.get(negocioId) ?? 'Negocio no disponible') : 'Negocio no disponible'
    const tipo = horario?.tipo_clase || horario?.tipo_servicio || r.servicio_nombre || '—'

    // Emparejar una visita por (negocio, fecha), consumiéndola para no duplicar.
    let monto: number | null = null
    let validadoPor: string | null = null
    if (negocioId) {
      const clave = `${negocioId}|${diaDe(r.fecha)}`
      const lista = visitasPorClave.get(clave)
      const visita = lista?.shift()
      if (visita) {
        monto = typeof visita.monto_negocio === 'number' ? visita.monto_negocio : null
        validadoPor = visita.validado_por ?? null
      }
    }

    return {
      fecha: r.fecha,
      negocio,
      tipo,
      hora: horario?.hora_inicio ?? null,
      estado: r.estado,
      escaneado: Boolean(validadoPor),
      monto,
    }
  })

  // 5) Resumen sobre TODAS las reservaciones.
  const total = items.length
  const asistencias = reservaciones.filter(r => r.estado === 'completada').length
  const noShows = reservaciones.filter(r => r.estado === 'no_show').length
  const denominador = asistencias + noShows
  const porcentajeAsistencia = denominador > 0 ? Math.round((asistencias * 100) / denominador) : null

  // 6) Paginación de 20 en 20.
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageSegura = Math.min(page, totalPaginas)
  const inicio = (pageSegura - 1) * PAGE_SIZE
  const pagina = items.slice(inicio, inicio + PAGE_SIZE)

  return NextResponse.json({
    resumen: { total, asistencias, noShows, porcentajeAsistencia },
    items: pagina,
    page: pageSegura,
    pageSize: PAGE_SIZE,
    totalPaginas,
    totalItems: total,
  })
}
