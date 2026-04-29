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
    .from('check_ins')
    .select('id, created_at, exitoso, users(nombre, plan), validadores(nombre)')
    .eq('negocio_id', session.negocio_id)
    .gte('created_at', inicioHoy.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('negocio_id', session.negocio_id)
    .eq('exitoso', true)
    .gte('created_at', inicioHoy.toISOString())

  return NextResponse.json({ historial: data, total_dia: count || 0 })
}
