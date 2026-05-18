import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { guardarSuscripcionPush } from '@/lib/push/server'
function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const db = admin()
  const { data: perfil, error: perfilError } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle<{ rol: 'usuario' | 'staff' | 'admin' }>()

  if (perfilError || !perfil) {
    return NextResponse.json({ error: 'No se pudo validar el rol del usuario' }, { status: 500 })
  }
  if (!['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos para registrar push de staff' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const subscription = (body as { subscription?: unknown }).subscription

  const result = await guardarSuscripcionPush(user.id, subscription)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
