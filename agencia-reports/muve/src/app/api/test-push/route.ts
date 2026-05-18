import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { enviarPushAUsuarios } from '@/lib/push/server'

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
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: subscriptions, error: subscriptionsError } = await db
    .from('push_subscriptions')
    .select('id, user_id, created_at, subscription')
    .eq('user_id', user.id)
    .limit(10)

  if (subscriptionsError) {
    console.error('[GET /api/test-push] Error consultando push_subscriptions:', subscriptionsError)
    return NextResponse.json({ error: 'No se pudo consultar push_subscriptions' }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json(
      { error: 'No hay suscripciones push para este usuario', subscription_count: 0 },
      { status: 404 }
    )
  }

  const resultado = await enviarPushAUsuarios([user.id], {
    title: 'Push de prueba MUVET',
    body: 'Si ves esta notificación, el canal push está funcionando.',
    url: '/negocio/dashboard',
  })

  return NextResponse.json({
    success: true,
    subscription_count: subscriptions.length,
    subscriptions: subscriptions.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      created_at: item.created_at,
      endpoint:
        typeof (item.subscription as { endpoint?: unknown })?.endpoint === 'string'
          ? (item.subscription as { endpoint: string }).endpoint
          : null,
    })),
    push_result: resultado,
  })
}
