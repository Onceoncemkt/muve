import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import webpush from 'web-push'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: subscriptions, error: subscriptionsError } = await db
    .from('push_subscriptions')
    .select('id, user_id, created_at, subscription')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (subscriptionsError) {
    console.error('[GET /api/test-push] Error consultando push_subscriptions:', subscriptionsError)
    return NextResponse.json({ ok: false, error: subscriptionsError.message }, { status: 500 })
  }
  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: false, error: 'No hay suscripciones push para este usuario' }, { status: 404 })
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: 'Faltan VAPID keys en el servidor' }, { status: 500 })
  }

  const subscription = subscriptions[0].subscription as webpush.PushSubscription
  webpush.setVapidDetails('mailto:hola@muvet.mx', publicKey, privateKey)

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: 'Push de prueba MUVET',
        body: 'Si ves esta notificación, el canal push está funcionando.',
        url: '/negocio/dashboard',
      })
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const statusCode = typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : null
    const message = err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Error desconocido enviando push'
    return NextResponse.json({ ok: false, error: message, statusCode }, { status: 500 })
  }
}