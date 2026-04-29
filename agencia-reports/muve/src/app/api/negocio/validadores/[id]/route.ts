import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
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

  const { data: validador } = await supabase
    .from('validadores')
    .select('negocio_id')
    .eq('id', id)
    .single<{ negocio_id: string }>()

  if (validador?.negocio_id !== userData.negocio_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  let nuevoPin: string | null = null

  if (typeof body.nombre === 'string' && body.nombre.trim().length >= 2) {
    updates.nombre = body.nombre.trim()
  }
  if (typeof body.activo === 'boolean') updates.activo = body.activo

  if (body.regenerar_pin === true) {
    nuevoPin = Math.floor(1000 + Math.random() * 9000).toString()
    updates.pin_hash = await bcrypt.hash(nuevoPin, 10)
  }

  const { error } = await supabase
    .from('validadores')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    pin: nuevoPin,
    mensaje: nuevoPin ? 'Anota el nuevo PIN. No podrás verlo de nuevo.' : 'Actualizado',
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
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

  const { data: validador } = await supabase
    .from('validadores')
    .select('negocio_id')
    .eq('id', id)
    .single<{ negocio_id: string }>()

  if (validador?.negocio_id !== userData?.negocio_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error } = await supabase
    .from('validadores')
    .update({
      activo: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
