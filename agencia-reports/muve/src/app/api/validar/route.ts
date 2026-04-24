import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Verificar que sea staff o admin
  const { data: perfil } = await supabase
    .from('users')
    .select('rol, nombre')
    .eq('id', user.id)
    .single()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { token, negocio_id } = await request.json()
  if (!token || !negocio_id) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // Buscar el token
  const { data: qrToken } = await supabase
    .from('qr_tokens')
    .select('*, users(nombre, ciudad, plan_activo)')
    .eq('token', token)
    .single()

  if (!qrToken) {
    return NextResponse.json({ valido: false, error: 'Token no encontrado' }, { status: 404 })
  }

  if (qrToken.usado) {
    return NextResponse.json({ valido: false, error: 'Token ya fue utilizado' })
  }

  if (new Date(qrToken.fecha_expiracion) < new Date()) {
    return NextResponse.json({ valido: false, error: 'Token expirado' })
  }

  const usuario = qrToken.users as { nombre: string; ciudad: string; plan_activo: boolean }

  if (!usuario?.plan_activo) {
    return NextResponse.json({ valido: false, error: 'Membresía inactiva' })
  }


  const { data: negocio } = await supabase
    .from('negocios')
    .select('nombre')
    .eq('id', negocio_id)
    .single()

  // Registrar visita y marcar token como usado
  const [{ error: visitaError }] = await Promise.all([
    supabase.from('visitas').insert({
      user_id: qrToken.user_id,
      negocio_id,
      validado_por: perfil.nombre,
    }),
    supabase.from('qr_tokens').update({ usado: true }).eq('id', qrToken.id),
  ])

  if (visitaError) {
    return NextResponse.json({ error: 'Error al registrar visita' }, { status: 500 })
  }

  return NextResponse.json({
    valido: true,
    usuario: usuario.nombre,
    negocio: negocio?.nombre,
  })
}
