import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { Rol } from '@/types'

type Perfil = {
  rol: Rol
  negocio_id: string | null
}

type NegocioDashboard = {
  id: string
  nombre: string
  ciudad: string
  categoria: string
  instagram_handle?: string | null
  tiktok_handle?: string | null
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

function validarFecha(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const parsed = new Date(`${fecha}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function normalizarHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim().replace(/^@+/, '')
  return limpio.length > 0 ? limpio : null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<Perfil>()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdSolicitado = searchParams.get('negocio_id')
  const fecha = searchParams.get('fecha') ?? hoyISO()

  if (!validarFecha(fecha)) {
    return NextResponse.json({ error: 'fecha inválida' }, { status: 400 })
  }

  if (perfil.rol === 'staff' && !perfil.negocio_id) {
    return NextResponse.json({
      sin_negocio: true,
      fecha,
      reservaciones: [],
      resumen: {
        reservaciones_hoy: 0,
        horarios_activos: 0,
      },
    })
  }

  if (perfil.rol === 'staff' && negocioIdSolicitado && negocioIdSolicitado !== perfil.negocio_id) {
    return NextResponse.json(
      { error: 'No puedes consultar datos de otro negocio' },
      { status: 403 }
    )
  }

  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdSolicitado ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json(
      { error: 'negocio_id requerido para admin' },
      { status: 400 }
    )
  }

  const consultasNegocio = [
    { select: 'id, nombre, ciudad, categoria, instagram_handle, tiktok_handle', incluyeInstagram: true, incluyeTiktok: true },
    { select: 'id, nombre, ciudad, categoria, instagram_handle', incluyeInstagram: true, incluyeTiktok: false },
    { select: 'id, nombre, ciudad, categoria', incluyeInstagram: false, incluyeTiktok: false },
  ] as const

  let negocio: NegocioDashboard | null = null
  let negocioError: { message?: string } | null = null

  for (const consulta of consultasNegocio) {
    const resultado = await db
      .from('negocios')
      .select(consulta.select)
      .eq('id', negocioIdObjetivo)
      .maybeSingle<NegocioDashboard>()

    if (!resultado.error && resultado.data) {
      negocio = {
        id: resultado.data.id,
        nombre: resultado.data.nombre,
        ciudad: resultado.data.ciudad,
        categoria: resultado.data.categoria,
        instagram_handle: consulta.incluyeInstagram ? (resultado.data.instagram_handle ?? null) : null,
        tiktok_handle: consulta.incluyeTiktok ? (resultado.data.tiktok_handle ?? null) : null,
      }
      negocioError = null
      break
    }

    negocioError = resultado.error
    const errorPorColumnaOpcional = (
      (consulta.incluyeInstagram && faltaColumna(resultado.error, 'instagram_handle'))
      || (consulta.incluyeTiktok && faltaColumna(resultado.error, 'tiktok_handle'))
    )
    if (!errorPorColumnaOpcional) break
  }

  if (negocioError || !negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const [{ data: reservaciones, error: reservacionesError }, { count: horariosActivos, error: horariosError }] = await Promise.all([
    db
      .from('reservaciones')
      .select(`
        id, fecha, estado, created_at,
        users ( id, nombre, email ),
        horarios!inner ( id, dia_semana, hora_inicio, hora_fin, negocio_id )
      `)
      .eq('horarios.negocio_id', negocioIdObjetivo)
      .eq('fecha', fecha)
      .order('horarios(hora_inicio)', { ascending: true }),
    db
      .from('horarios')
      .select('id', { count: 'exact', head: true })
      .eq('negocio_id', negocioIdObjetivo)
      .eq('activo', true),
  ])

  if (reservacionesError || horariosError) {
    return NextResponse.json(
      { error: reservacionesError?.message ?? horariosError?.message ?? 'Error al cargar dashboard' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    sin_negocio: false,
    fecha,
    negocio,
    resumen: {
      reservaciones_hoy: (reservaciones ?? []).length,
      horarios_activos: horariosActivos ?? 0,
    },
    reservaciones: reservaciones ?? [],
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<Perfil>()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as {
    instagram_handle?: unknown
    tiktok_handle?: unknown
    negocio_id?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : null
  const negocioIdQuery = searchParams.get('negocio_id')
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdBody ?? negocioIdQuery ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json({ error: 'negocio_id requerido' }, { status: 400 })
  }

  const instagramHandle = normalizarHandle(body.instagram_handle)
  const tiktokHandle = normalizarHandle(body.tiktok_handle)

  const payload: Record<string, string | null> = {
    instagram_handle: instagramHandle,
    tiktok_handle: tiktokHandle,
  }

  let error: { message?: string } | null = null

  for (let intento = 0; intento < 3; intento += 1) {
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
    return NextResponse.json(
      { error: error.message ?? 'No se pudo actualizar el perfil del negocio' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    negocio: {
      id: negocioIdObjetivo,
      instagram_handle: 'instagram_handle' in payload ? instagramHandle : null,
      tiktok_handle: 'tiktok_handle' in payload ? tiktokHandle : null,
    },
  })
}
