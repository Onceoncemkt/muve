import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  PLAN_MAX_VISITAS_POR_LUGAR,
  PLAN_VISITAS_MENSUALES,
  normalizarPlan,
} from '@/lib/planes'

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
    .select('*, users(nombre, ciudad, plan_activo, plan)')
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

  const usuario = qrToken.users as { nombre: string; ciudad: string; plan_activo: boolean; plan?: unknown }
  const planUsuario = normalizarPlan(usuario?.plan ?? null) ?? 'basico'

  if (!usuario?.plan_activo) {
    return NextResponse.json({ valido: false, error: 'Usuario sin membresía activa' })
  }
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const [{ count: visitasMes, error: visitasMesError }, { count: visitasLugarMes, error: visitasLugarMesError }] = await Promise.all([
    db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', qrToken.user_id)
      .gte('fecha', inicioMes.toISOString()),
    db
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', qrToken.user_id)
      .eq('negocio_id', negocioIdObjetivo)
      .gte('fecha', inicioMes.toISOString()),
  ])

  if (visitasMesError || visitasLugarMesError) {
    return NextResponse.json({ error: 'No se pudieron validar límites de visitas' }, { status: 500 })
  }

  const limiteMensual = PLAN_VISITAS_MENSUALES[planUsuario]
  if ((visitasMes ?? 0) >= limiteMensual) {
    return NextResponse.json({ valido: false, error: 'Usuario agotó sus visitas del mes' })
  }

  const limitePorLugar = PLAN_MAX_VISITAS_POR_LUGAR[planUsuario]
  if ((visitasLugarMes ?? 0) >= limitePorLugar) {
    return NextResponse.json({
      valido: false,
      error: 'Límite de visitas en este lugar alcanzado',
    })
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
      plan_usuario: planUsuario,
    }),
    db.from('qr_tokens').update({ usado: true }).eq('id', qrToken.id),
  ])

  if (visitaError) {
    return NextResponse.json({ error: 'Error al registrar visita' }, { status: 500 })
  }

  const visitasUsadasMes = (visitasMes ?? 0) + 1
  const visitasRestantesMes = Math.max(limiteMensual - visitasUsadasMes, 0)

  return NextResponse.json({
    valido: true,
    usuario: usuario.nombre,
    negocio: negocio?.nombre,
    visitas_restantes_mes: visitasRestantesMes,
    visitas_usadas_mes: visitasUsadasMes,
    limite_visitas_mensuales: limiteMensual,
  })
}
