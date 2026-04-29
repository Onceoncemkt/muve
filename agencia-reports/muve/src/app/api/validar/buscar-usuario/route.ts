import { NextRequest, NextResponse } from 'next/server'
import { getValidadorSession } from '@/lib/validador-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const session = await getValidadorSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 3) {
    return NextResponse.json({ error: 'Búsqueda muy corta' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, nombre, email, telefono, plan, plan_activo, creditos_extra')
    .or(`email.ilike.%${q}%,telefono.ilike.%${q}%`)
    .eq('rol', 'usuario')
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuarios: data })
}
