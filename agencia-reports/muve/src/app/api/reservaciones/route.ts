import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { DiaSemana } from '@/types'
function diaSemanaDesdeFecha(fecha: string): DiaSemana | null {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return dias[date.getDay()]
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/reservaciones — próximas reservaciones del usuario autenticado
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hoy = new Date().toISOString().split('T')[0]
  const now_ms = Date.now()

  const { data, error } = await admin()
    .from('reservaciones')
    .select(`
      id, fecha, estado, created_at,
      horarios (
        id, dia_semana, hora_inicio, hora_fin, capacidad_total,
        negocios ( id, nombre, direccion )
      )
    `)
    .eq('user_id', user.id)
    .gte('fecha', hoy)
    .order('fecha', { ascending: true })
    .order('horarios(hora_inicio)', { ascending: true })

  if (error) {
    console.error('[GET /api/reservaciones]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reservaciones: data, now_ms })
}

// POST /api/reservaciones — crear reservación
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { horario_id, fecha } = body as { horario_id?: string; fecha?: string }

  if (!horario_id || !fecha) {
    return NextResponse.json({ error: 'horario_id y fecha son requeridos' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' }, { status: 400 })
  }

  const diaSolicitado = diaSemanaDesdeFecha(fecha)
  if (!diaSolicitado) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const hoy = new Date().toISOString().split('T')[0]
  if (fecha < hoy) {
    return NextResponse.json({ error: 'No puedes reservar fechas pasadas' }, { status: 400 })
  }

  const db = admin()

  // Verificar que el horario existe y está activo
  const { data: horario, error: hError } = await db
    .from('horarios')
    .select('id, capacidad_total, activo, dia_semana')
    .eq('id', horario_id)
    .single()

  if (hError || !horario) {
    return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 })
  }
  if (!horario.activo) {
    return NextResponse.json({ error: 'Horario no disponible' }, { status: 400 })
  }
  if (horario.dia_semana !== diaSolicitado) {
    return NextResponse.json(
      { error: 'Este horario no corresponde al día seleccionado' },
      { status: 400 }
    )
  }

  // Verificar spots disponibles
  const { count } = await db
    .from('reservaciones')
    .select('id', { count: 'exact', head: true })
    .eq('horario_id', horario_id)
    .eq('fecha', fecha)
    .eq('estado', 'confirmada')

  if ((count ?? 0) >= horario.capacidad_total) {
    return NextResponse.json({ error: 'No hay spots disponibles' }, { status: 409 })
  }

  // Crear reservación
  const { data: nueva, error: iError } = await db
    .from('reservaciones')
    .insert({ user_id: user.id, horario_id, fecha, estado: 'confirmada' })
    .select('id, fecha, estado')
    .single()

  if (iError) {
    if (iError.code === '23505') {
      return NextResponse.json({ error: 'Ya tienes una reservación en este horario' }, { status: 409 })
    }
    console.error('[POST /api/reservaciones]', iError)
    return NextResponse.json({ error: iError.message }, { status: 500 })
  }

  return NextResponse.json({ reservacion: nueva }, { status: 201 })
}
