import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/negocio/reservaciones?negocio_id=xxx&fecha=YYYY-MM-DD
// Reservaciones del negocio para una fecha (default hoy) — solo staff/admin
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()

  const { data: perfil } = await db
    .from('users').select('rol').eq('id', user.id).single()
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocio_id = searchParams.get('negocio_id')
  const fecha = searchParams.get('fecha') ?? new Date().toISOString().split('T')[0]

  if (!negocio_id) {
    return NextResponse.json({ error: 'negocio_id requerido' }, { status: 400 })
  }

  const { data, error } = await db
    .from('reservaciones')
    .select(`
      id, fecha, estado, created_at,
      users ( id, nombre, email ),
      horarios!inner ( id, dia_semana, hora_inicio, hora_fin, negocio_id )
    `)
    .eq('horarios.negocio_id', negocio_id)
    .eq('fecha', fecha)
    .order('horarios(hora_inicio)', { ascending: true })

  if (error) {
    console.error('[GET /api/negocio/reservaciones]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reservaciones: data })
}
