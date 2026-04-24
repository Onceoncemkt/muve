import { NextRequest, NextResponse } from 'next/server'
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

type PushSendBody = {
  user_id?: string
  user_ids?: string[]
  title?: string
  body?: string
  url?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: string }>()

  if (!perfil || !['admin', 'staff'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as PushSendBody
  const title = body.title?.trim() ?? ''
  const message = body.body?.trim() ?? ''
  const targets = [
    ...(typeof body.user_id === 'string' ? [body.user_id] : []),
    ...(Array.isArray(body.user_ids) ? body.user_ids : []),
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0)

  if (!title || !message || targets.length === 0) {
    return NextResponse.json(
      { error: 'title, body y user_id/user_ids son requeridos' },
      { status: 400 }
    )
  }

  const result = await enviarPushAUsuarios(targets, {
    title,
    body: message,
    url: typeof body.url === 'string' && body.url.startsWith('/')
      ? body.url
      : undefined,
  })

  return NextResponse.json({
    success: true,
    result,
  })
}
