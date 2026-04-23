import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const ahora = new Date()
  const inicioDia = new Date(ahora)
  inicioDia.setHours(0, 0, 0, 0)

  // Buscar token válido de hoy (no usado, no expirado)
  const { data: tokenExistente } = await supabase
    .from('qr_tokens')
    .select('*')
    .eq('user_id', user.id)
    .eq('usado', false)
    .gte('fecha_expiracion', ahora.toISOString())
    .gte('fecha_expiracion', inicioDia.toISOString())
    .order('fecha_expiracion', { ascending: false })
    .limit(1)
    .single()

  if (tokenExistente) {
    return NextResponse.json({ token: tokenExistente.token, fecha_expiracion: tokenExistente.fecha_expiracion })
  }

  // Generar nuevo token para hoy
  const token = randomBytes(24).toString('hex')
  const expiracion = new Date(ahora)
  expiracion.setHours(23, 59, 59, 999)

  const { data: nuevoToken, error } = await supabase
    .from('qr_tokens')
    .insert({
      user_id: user.id,
      token,
      fecha_expiracion: expiracion.toISOString(),
      usado: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al generar token' }, { status: 500 })
  }

  return NextResponse.json({ token: nuevoToken.token, fecha_expiracion: nuevoToken.fecha_expiracion })
}
