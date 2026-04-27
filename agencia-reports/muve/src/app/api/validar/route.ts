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

  function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
    const message = error?.message?.toLowerCase() ?? ''
    return message.includes('column') && message.includes(columna.toLowerCase())
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


  let negocio: { nombre: string; categoria: string | null; monto_maximo_visita: number | null } | null = null
  const consultaNegocio = await db
    .from('negocios')
    .select('nombre, categoria, monto_maximo_visita')
    .eq('id', negocioIdObjetivo)
    .maybeSingle<{ nombre: string; categoria: string | null; monto_maximo_visita: number | null }>()

  if (!consultaNegocio.error && consultaNegocio.data) {
    negocio = consultaNegocio.data
  } else if (faltaColumna(consultaNegocio.error, 'monto_maximo_visita')) {
    const fallbackNegocio = await db
      .from('negocios')
      .select('nombre, categoria')
      .eq('id', negocioIdObjetivo)
      .maybeSingle<{ nombre: string; categoria: string | null }>()
    if (!fallbackNegocio.error && fallbackNegocio.data) {
      negocio = {
        ...fallbackNegocio.data,
        monto_maximo_visita: null,
      }
    }
  }

  if (!negocio) {
    return NextResponse.json({ error: 'No se pudo validar el negocio' }, { status: 400 })
  }

  const categoriaNegocio = typeof negocio.categoria === 'string' ? negocio.categoria : null
  const montoMaximoAutorizadoMxn = categoriaNegocio === 'restaurante'
    ? Math.max(Math.trunc(negocio.monto_maximo_visita ?? 0), 0)
    : null

  let servicioReservado: { id: string; nombre: string; precio_normal_mxn: number | null; fecha: string } | null = null
  if (categoriaNegocio === 'estetica') {
    const hoy = new Date().toISOString().split('T')[0]
    const { data: horariosNegocio, error: horariosError } = await db
      .from('horarios')
      .select('id')
      .eq('negocio_id', negocioIdObjetivo)

    if (horariosError) {
      return NextResponse.json({ error: 'No se pudieron validar los horarios del negocio' }, { status: 500 })
    }

    const horarioIds = Array.isArray(horariosNegocio)
      ? horariosNegocio.map((item) => item.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    if (horarioIds.length === 0) {
      return NextResponse.json(
        { valido: false, error: 'Este negocio wellness no tiene horarios configurados' },
        { status: 400 }
      )
    }

    const { data: reservacionWellness, error: reservacionWellnessError } = await db
      .from('reservaciones')
      .select('id, fecha, servicio_id, servicio_nombre, servicio_precio_normal_mxn, created_at')
      .eq('user_id', qrToken.user_id)
      .eq('estado', 'confirmada')
      .eq('fecha', hoy)
      .in('horario_id', horarioIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string
        fecha: string
        servicio_id: string | null
        servicio_nombre: string | null
        servicio_precio_normal_mxn: number | null
        created_at: string
      }>()

    if (
      faltaColumna(reservacionWellnessError, 'servicio_id')
      || faltaColumna(reservacionWellnessError, 'servicio_nombre')
      || faltaColumna(reservacionWellnessError, 'servicio_precio_normal_mxn')
    ) {
      return NextResponse.json(
        { error: 'Faltan columnas de servicio en reservaciones. Ejecuta la migración 017 en Supabase.' },
        { status: 500 }
      )
    }

    if (reservacionWellnessError) {
      return NextResponse.json({ error: 'No se pudo validar la reservación wellness' }, { status: 500 })
    }

    if (!reservacionWellness || !reservacionWellness.servicio_nombre) {
      return NextResponse.json(
        { valido: false, error: 'No hay servicio wellness reservado para hoy en este negocio' },
        { status: 400 }
      )
    }

    servicioReservado = {
      id: reservacionWellness.servicio_id ?? reservacionWellness.id,
      nombre: reservacionWellness.servicio_nombre,
      precio_normal_mxn: reservacionWellness.servicio_precio_normal_mxn,
      fecha: reservacionWellness.fecha,
    }
  }

  // Registrar visita y marcar token como usado
  const [{ error: visitaError }, { error: tokenError }, { error: ultimoCheckinError }] = await Promise.all([
    db.from('visitas').insert({
      user_id: qrToken.user_id,
      negocio_id: negocioIdObjetivo,
      validado_por: perfil.nombre,
      plan_usuario: planUsuario,
    }),
    db.from('qr_tokens').update({ usado: true }).eq('id', qrToken.id),
    db.from('users').update({ ultimo_checkin: new Date().toISOString() }).eq('id', qrToken.user_id),
  ])

  if (visitaError) {
    return NextResponse.json({ error: 'Error al registrar visita' }, { status: 500 })
  }
  if (tokenError) {
    return NextResponse.json({ error: 'Error al marcar token como usado' }, { status: 500 })
  }
  if (ultimoCheckinError && !faltaColumna(ultimoCheckinError, 'ultimo_checkin')) {
    console.warn('[POST /api/validar] No se pudo actualizar ultimo_checkin', ultimoCheckinError)
  }

  const visitasUsadasMes = (visitasMes ?? 0) + 1
  const visitasRestantesMes = Math.max(limiteMensual - visitasUsadasMes, 0)

  return NextResponse.json({
    valido: true,
    usuario: usuario.nombre,
    negocio: negocio.nombre,
    categoria_negocio: categoriaNegocio,
    servicio_reservado: servicioReservado,
    monto_maximo_autorizado_mxn: montoMaximoAutorizadoMxn,
    visitas_restantes_mes: visitasRestantesMes,
    visitas_usadas_mes: visitasUsadasMes,
    limite_visitas_mensuales: limiteMensual,
  })
}
