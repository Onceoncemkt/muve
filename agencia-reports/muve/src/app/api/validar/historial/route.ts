import { NextResponse } from 'next/server'
import { getValidadorSession } from '@/lib/validador-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getValidadorSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const inicioHoy = new Date()
  inicioHoy.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('visitas')
    .select('id, fecha, validado_por, users(nombre, plan)')
    .eq('negocio_id', session.negocio_id)
    .gte('fecha', inicioHoy.toISOString())
    .order('fecha', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await supabase
    .from('visitas')
    .select('*', { count: 'exact', head: true })
    .eq('negocio_id', session.negocio_id)
    .gte('fecha', inicioHoy.toISOString())

  const historial = (data ?? []).map((item) => ({
    ...item,
    created_at: item.fecha,
    exitoso: true,
  }))

  return NextResponse.json({ historial, total_dia: count || 0 })
}
