import { createClient as createAdminClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export type PushNotificationPayload = {
  title: string
  body: string
  url?: string
}

type StoredPushSubscriptionRow = {
  id: string
  user_id: string
  subscription: webpush.PushSubscription
}

let vapidConfigured = false

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

function esPushSubscription(value: unknown): value is webpush.PushSubscription {
  if (!value || typeof value !== 'object') return false
  const endpoint = (value as { endpoint?: unknown }).endpoint
  return typeof endpoint === 'string' && endpoint.length > 0
}

function obtenerStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const status = (error as { statusCode?: unknown }).statusCode
  return typeof status === 'number' ? status : null
}

function ensureVapidConfigured() {
  if (vapidConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    console.warn('[push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY')
    return false
  }

  webpush.setVapidDetails(
    'mailto:soporte@muvet.app',
    publicKey,
    privateKey
  )
  vapidConfigured = true
  return true
}

export async function guardarSuscripcionPush(userId: string, subscription: unknown) {
  if (!esPushSubscription(subscription)) {
    return { ok: false, error: 'Suscripción inválida' as const }
  }

  const db = admin()

  // Evita duplicados por endpoint del mismo usuario
  const endpoint = subscription.endpoint
  await db
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .contains('subscription', { endpoint })

  const { error } = await db
    .from('push_subscriptions')
    .insert({ user_id: userId, subscription })

  if (error) {
    console.error('[push] Error al guardar suscripción:', error.message)
    return { ok: false, error: 'No se pudo guardar la suscripción' as const }
  }

  return { ok: true as const }
}

export async function obtenerStaffIdsPorNegocio(negocioId: string) {
  const db = admin()

  const { data, error } = await db
    .from('users')
    .select('id')
    .eq('rol', 'staff')
    .eq('negocio_id', negocioId)

  if (!error) {
    return (data ?? [])
      .map(row => row.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  }

  // Compatibilidad con esquemas donde negocio_id no existe.
  if (faltaColumna(error, 'negocio_id')) {
    return [] as string[]
  }

  console.error('[push] Error al consultar staff por negocio:', error.message)
  return [] as string[]
}

export async function enviarPushAUsuarios(
  userIds: string[],
  payload: PushNotificationPayload
) {
  const objetivos = [...new Set(userIds.filter(id => typeof id === 'string' && id.length > 0))]
  if (objetivos.length === 0) {
    return { sent: 0, failed: 0, total: 0 }
  }

  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, total: 0 }
  }

  const db = admin()
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, user_id, subscription')
    .in('user_id', objetivos)

  if (error) {
    console.error('[push] Error al cargar suscripciones:', error.message)
    return { sent: 0, failed: objetivos.length, total: 0 }
  }

  const subscriptions = (data ?? []) as unknown as StoredPushSubscriptionRow[]
  let sent = 0
  let failed = 0
  const invalidSubscriptionIds: string[] = []

  for (const row of subscriptions) {
    if (!esPushSubscription(row.subscription)) {
      failed += 1
      invalidSubscriptionIds.push(row.id)
      continue
    }

    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url ?? '/dashboard',
        })
      )
      sent += 1
    } catch (error) {
      failed += 1
      const statusCode = obtenerStatusCode(error)
      if (statusCode === 404 || statusCode === 410) {
        invalidSubscriptionIds.push(row.id)
      }
      console.error('[push] Error al enviar push:', error)
    }
  }

  if (invalidSubscriptionIds.length > 0) {
    await db
      .from('push_subscriptions')
      .delete()
      .in('id', invalidSubscriptionIds)
  }

  return { sent, failed, total: subscriptions.length }
}
