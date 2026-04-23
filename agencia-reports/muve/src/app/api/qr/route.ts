import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const ahora = new Date()

  // Buscar token válido no usado que aún no haya expirado
  const { data: tokenExistente } = await supabase
    .from('qr_tokens')
    .select('token, fecha_expiracion')
    .eq('user_id', user.id)
    .eq('usado', false)
    .gt('fecha_expiracion', ahora.toISOString())
    .order('fecha_expiracion', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tokenExistente) {
    return NextResponse.json({
      token: tokenExistente.token,
      fecha_expiracion: tokenExistente.fecha_expiracion,
    })
  }

  // Generar nuevo token — expira 24 horas desde ahora
  const token = randomBytes(24).toString('hex')
  const expiracion = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)

  const { data: nuevoToken, error: insertError } = await supabase
    .from('qr_tokens')
    .insert({
      user_id: user.id,
      token,
      fecha_expiracion: expiracion.toISOString(),
      usado: false,
    })
    .select('token, fecha_expiracion')
    .single()

  if (insertError || !nuevoToken) {
    console.error('[/api/qr] insert error:', insertError)
    return NextResponse.json(
      { error: 'Error al generar token', detail: insertError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    token: nuevoToken.token,
    fecha_expiracion: nuevoToken.fecha_expiracion,
  })
}
