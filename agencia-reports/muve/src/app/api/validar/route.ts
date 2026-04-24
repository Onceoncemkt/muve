import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const authClient = await createClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = createServiceClient()

  function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() ?? ''
    return message.includes('column') && message.includes('negocio_id')
  }

  // Verificar que sea staff o admin
  let perfil: { rol: string; nombre: string | null; negocio_id: string | null } | null = null
  const consultaPerfil = await db
    .from('users')
    .select('rol, nombre, negocio_id')
    .eq('id', user.id)
    .single<{ rol: string; nombre: string | null; negocio_id: string | null }>()

  if (!consultaPerfil.error && consultaPerfil.data) {
    perfil = consultaPerfil.data
  } else if (faltaColumnaNegocioId(consultaPerfil.error)) {
    const fallback = await db
      .from('users')
      .select('rol, nombre')
      .eq('id', user.id)
      .single<{ rol: string; nombre: string | null }>()
    if (!fallback.error && fallback.data) {
      perfil = { ...fallback.data, negocio_id: null }
    }
  }

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const negocioIdBody = typeof body.negocio_id === 'string' ? body.negocio_id : ''
  if (!token) {
    return NextResponse.json({ error: 'Falta token' }, { status: 400 })
  }

  const negocioIdObjetivo = perfil.rol === 'staff' ? (perfil.negocio_id ?? '') : negocioIdBody
  if (!negocioIdObjetivo) {
    return NextResponse.json(
      {
        error: perfil.rol === 'staff'
          ? 'Tu cuenta no tiene negocio asignado'
          : 'Falta negocio_id',
      },
      { status: 400 }
    )
  }

  // Buscar el token
  const { data: qrToken } = await db
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


  const { data: negocio } = await db
    .from('negocios')
    .select('nombre')
    .eq('id', negocioIdObjetivo)
    .single()

  // Registrar visita y marcar token como usado
  const [{ error: visitaError }] = await Promise.all([
    db.from('visitas').insert({
      user_id: qrToken.user_id,
      negocio_id: negocioIdObjetivo,
      validado_por: perfil.nombre,
    }),
    db.from('qr_tokens').update({ usado: true }).eq('id', qrToken.id),
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
