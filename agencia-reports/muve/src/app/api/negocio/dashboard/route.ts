import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { Rol } from '@/types'

type Perfil = {
  rol: Rol
  negocio_id: string | null
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

  const { data: negocio, error: negocioError } = await db
    .from('negocios')
    .select('id, nombre, ciudad, categoria')
    .eq('id', negocioIdObjetivo)
    .maybeSingle()

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
