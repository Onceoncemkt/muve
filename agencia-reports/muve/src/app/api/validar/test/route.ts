import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getValidadorSession } from '@/lib/validador-auth'

/**
 * Endpoint de diagnóstico (solo lectura) para el flujo de validación de QR.
 *
 *   GET /api/validar/test?negocio_id=<uuid>
 *
 * Requiere sesión de validador o usuario staff/admin. NUNCA expone secretos: del
 * WALLET_SECRET solo devuelve si está configurado, su longitud y una huella sha256
 * (primeros 8 hex). Recuerda: WALLET_SECRET es para los passes de Apple/Google Wallet,
 * NO interviene en la validación del QR (el QR es sha256(user_id) en hex).
 */
export async function GET(request: NextRequest) {
  const db = createServiceClient()

  // --- Autorización: validador o staff/admin ---
  let autorizado = false
  let rolDetectado: string | null = null
  const validadorSession = await getValidadorSession()
  if (validadorSession) {
    autorizado = true
    rolDetectado = 'validador'
  } else {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (user) {
      const { data: perfil } = await db
        .from('users')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle<{ rol: string }>()
      if (perfil && (perfil.rol === 'staff' || perfil.rol === 'admin')) {
        autorizado = true
        rolDetectado = perfil.rol
      }
    }
  }
  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // --- Entorno (sin exponer valores secretos) ---
  const walletSecret = process.env.WALLET_SECRET ?? ''
  const entorno = {
    supabase_url_configurada: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    service_role_configurada: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    wallet_secret: {
      configurada: walletSecret.length > 0,
      longitud: walletSecret.length,
      huella_sha256: walletSecret
        ? createHash('sha256').update(walletSecret).digest('hex').slice(0, 8)
        : null,
      nota: 'WALLET_SECRET solo se usa para los passes de Apple/Google Wallet. NO afecta la validación del QR.',
    },
  }

  // --- Verificar que el RPC de validación de QR existe (esto SÍ afecta el escaneo) ---
  // sha256 de un UUID inexistente: debe devolver 0 filas, pero sin error de "función no existe".
  const hashPrueba = createHash('sha256').update('00000000-0000-0000-0000-000000000000').digest('hex')
  let rpcEstado: string
  const { error: rpcError } = await db
    .rpc('buscar_usuario_por_qr_hash', { p_hash: hashPrueba })
    .maybeSingle()
  if (!rpcError) {
    rpcEstado = 'ok'
  } else if ((rpcError.message ?? '').toLowerCase().includes('buscar_usuario_por_qr_hash')) {
    rpcEstado = 'FALTA: ejecuta la migración 024 en Supabase'
  } else {
    rpcEstado = `error: ${rpcError.message}`
  }

  const qr = {
    metodo: 'sha256(user_id) en hex, minúsculas',
    rpc_buscar_usuario_por_qr_hash: rpcEstado,
  }

  // --- Estado del negocio (opcional, si se pasa negocio_id) ---
  const negocioId = request.nextUrl.searchParams.get('negocio_id')?.trim() ?? ''
  let negocio: Record<string, unknown> | null = null
  if (negocioId) {
    const { data: neg, error: negError } = await db
      .from('negocios')
      .select('id, nombre, categoria, zona, ciudad, plan_negocio, requiere_reserva')
      .eq('id', negocioId)
      .maybeSingle<{
        id: string
        nombre: string
        categoria: string | null
        zona: string | null
        ciudad: string | null
        plan_negocio: string | null
        requiere_reserva: boolean | null
      }>()

    if (negError || !neg) {
      negocio = { encontrado: false, error: negError?.message ?? 'Negocio no encontrado' }
    } else {
      const hoy = new Date().toISOString().split('T')[0]
      const { count: totalHorarios } = await db
        .from('horarios')
        .select('id', { count: 'exact', head: true })
        .eq('negocio_id', neg.id)

      const { data: horariosDelNegocio } = await db
        .from('horarios')
        .select('id')
        .eq('negocio_id', neg.id)
      const horarioIds = (horariosDelNegocio ?? [])
        .map((h) => h.id)
        .filter((id): id is string => typeof id === 'string')

      let reservacionesConfirmadasHoy = 0
      if (horarioIds.length > 0) {
        const { count } = await db
          .from('reservaciones')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'confirmada')
          .eq('fecha', hoy)
          .in('horario_id', horarioIds)
        reservacionesConfirmadasHoy = count ?? 0
      }

      negocio = {
        encontrado: true,
        id: neg.id,
        nombre: neg.nombre,
        categoria: neg.categoria,
        zona: neg.zona,
        ciudad: neg.ciudad,
        plan_negocio: neg.plan_negocio,
        requiere_reserva: neg.requiere_reserva,
        total_horarios: totalHorarios ?? 0,
        reservaciones_confirmadas_hoy: reservacionesConfirmadasHoy,
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rol_detectado: rolDetectado,
    timestamp: new Date().toISOString(),
    entorno,
    qr,
    negocio,
  })
}
