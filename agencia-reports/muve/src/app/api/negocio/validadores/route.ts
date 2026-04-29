import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { negocioAccessCode } from '@/lib/negocio-code'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<{ rol: string; negocio_id: string | null }>()

  if (userData?.rol !== 'staff' && userData?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo staff puede crear validadores' }, { status: 403 })
  }

  if (!userData.negocio_id) {
    return NextResponse.json({ error: 'Sin negocio asignado' }, { status: 403 })
  }

  const { nombre } = await req.json().catch(() => ({}))
  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }

  const pin = Math.floor(1000 + Math.random() * 9000).toString()
  const pin_hash = await bcrypt.hash(pin, 10)

  const { data, error } = await supabase
    .from('validadores')
    .insert({
      negocio_id: userData.negocio_id,
      nombre: nombre.trim(),
      pin_hash,
      activo: true,
    })
    .select('id, nombre, activo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    validador: data,
    pin,
    mensaje: 'Anota este PIN. No podrás verlo de nuevo.',
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('rol, negocio_id')
    .eq('id', user.id)
    .single<{ rol: string; negocio_id: string | null }>()

  if (userData?.rol !== 'staff' && userData?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo staff' }, { status: 403 })
  }

  if (!userData?.negocio_id) {
    return NextResponse.json({ error: 'Sin negocio asignado' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('validadores')
    .select('id, nombre, activo, ultima_actividad, created_at')
    .eq('negocio_id', userData.negocio_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    validadores: data,
    codigo_negocio: negocioAccessCode(userData.negocio_id),
  })
}
