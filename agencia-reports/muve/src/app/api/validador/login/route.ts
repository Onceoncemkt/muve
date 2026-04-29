import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

function normalizarNombre(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export async function POST(req: NextRequest) {
  const { email_negocio, pin, nombre_validador } = await req.json().catch(() => ({}))

  if (!email_negocio || !pin || !nombre_validador) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: staffUser } = await supabase
    .from('users')
    .select('negocio_id')
    .eq('email', email_negocio)
    .eq('rol', 'staff')
    .single<{ negocio_id: string | null }>()

  if (!staffUser?.negocio_id) {
    return NextResponse.json({ error: 'Negocio no encontrado o inactivo' }, { status: 404 })
  }

  const { data: negocio } = await supabase
    .from('negocios')
    .select('id, nombre, activo')
    .eq('id', staffUser.negocio_id)
    .single<{ id: string; nombre: string; activo: boolean }>()

  if (!negocio?.activo) {
    return NextResponse.json({ error: 'Negocio no encontrado o inactivo' }, { status: 404 })
  }

  const { data: validadores } = await supabase
    .from('validadores')
    .select('id, nombre, pin_hash')
    .eq('negocio_id', staffUser.negocio_id)
    .eq('activo', true)

  if (!validadores?.length) {
    return NextResponse.json({ error: 'Sin validadores configurados' }, { status: 404 })
  }

  let validadorMatch: { id: string; nombre: string; pin_hash: string } | null = null
  for (const v of validadores) {
    if (await bcrypt.compare(String(pin), v.pin_hash)) {
      validadorMatch = v
      break
    }
  }

  if (!validadorMatch) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  if (normalizarNombre(validadorMatch.nombre) !== normalizarNombre(String(nombre_validador))) {
    return NextResponse.json({ error: 'Nombre no coincide con el PIN' }, { status: 401 })
  }

  await supabase
    .from('validadores')
    .update({ ultima_actividad: new Date().toISOString() })
    .eq('id', validadorMatch.id)

  const cookieStore = await cookies()
  cookieStore.set('muvet_validador', JSON.stringify({
    validador_id: validadorMatch.id,
    negocio_id: staffUser.negocio_id,
    nombre: validadorMatch.nombre,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  return NextResponse.json({
    nombre: validadorMatch.nombre,
    negocio_nombre: negocio.nombre,
  })
}
