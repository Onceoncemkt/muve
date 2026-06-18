import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarPlan, tarifaNegocioPorCheckin } from '@/lib/planes'
import { faltaColumna } from '@/lib/stripe-connect'

type ReservacionCompletada = {
  id: string
  user_id: string
  fecha: string
  horario_id: string | null
}

/**
 * Registra una visita en la tabla `visitas` cuando una reservación pasa a 'completada'
 * desde el panel admin o desde el staff (PATCH de reservaciones), replicando el alta de
 * visita que hace `/api/validar` al escanear el QR.
 *
 * Calcula el monto al negocio según su plan, zona y categoría con `tarifaNegocioPorCheckin`,
 * y maneja el fallback por si la columna `monto_negocio` no existe (igual que /api/validar).
 *
 * IMPORTANTE — idempotencia: el llamador SOLO debe invocar esta función cuando la
 * reservación NO estaba ya en estado 'completada'. Así evitamos duplicar la visita que el
 * QR ya pudo haber creado al completar la misma reservación.
 */
export async function registrarVisitaPorReservacionCompletada(
  db: SupabaseClient,
  reservacion: ReservacionCompletada,
  validadoPor: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!reservacion.horario_id) {
    return { ok: false, error: 'La reservación no tiene horario asociado' }
  }

  // 1) Resolver el negocio a partir del horario de la reservación.
  const { data: horario, error: horarioError } = await db
    .from('horarios')
    .select('negocio_id')
    .eq('id', reservacion.horario_id)
    .maybeSingle<{ negocio_id: string | null }>()

  const negocioId = typeof horario?.negocio_id === 'string' ? horario.negocio_id : null
  if (horarioError || !negocioId) {
    return { ok: false, error: 'No se pudo resolver el negocio de la reservación' }
  }

  // 2) Datos del negocio necesarios para tarifar el check-in.
  const negocioConsulta = await db
    .from('negocios')
    .select('categoria, zona, ciudad, plan_negocio')
    .eq('id', negocioId)
    .maybeSingle<{
      categoria: string | null
      zona: string | null
      ciudad: string | null
      plan_negocio: string | null
    }>()

  if (negocioConsulta.error && !faltaColumna(negocioConsulta.error, 'plan_negocio')) {
    return { ok: false, error: negocioConsulta.error.message }
  }

  const negocio = negocioConsulta.data ?? {
    categoria: null,
    zona: null,
    ciudad: null,
    plan_negocio: null,
  }

  // 3) Plan del usuario dueño de la reservación (para registrar plan_usuario).
  const { data: usuario } = await db
    .from('users')
    .select('plan')
    .eq('id', reservacion.user_id)
    .maybeSingle<{ plan: string | null }>()

  const planUsuario = normalizarPlan(usuario?.plan ?? null) ?? 'basico'

  // 4) Monto al negocio según plan del negocio + zona + categoría.
  const montoNegocio = tarifaNegocioPorCheckin({
    categoria: negocio.categoria,
    planNegocio: negocio.plan_negocio,
    zona: negocio.zona,
    ciudad: negocio.ciudad,
  })

  // 5) Alta en visitas (mismo shape que /api/validar). Usamos la fecha del servicio
  //    (la de la reservación) para que el pago al negocio caiga en el periodo correcto.
  const payloadVisita = {
    user_id: reservacion.user_id,
    negocio_id: negocioId,
    fecha: reservacion.fecha,
    validado_por: validadoPor,
    plan_usuario: planUsuario,
  }

  const insercionConMonto = await db
    .from('visitas')
    .insert({ ...payloadVisita, monto_negocio: montoNegocio })

  let visitaError = insercionConMonto.error
  if (faltaColumna(insercionConMonto.error, 'monto_negocio')) {
    const insercionFallback = await db.from('visitas').insert(payloadVisita)
    visitaError = insercionFallback.error
  }

  if (visitaError) {
    return { ok: false, error: visitaError.message ?? 'Error al registrar la visita' }
  }

  return { ok: true }
}
