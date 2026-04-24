import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Rol } from '@/types'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({} as { plan_activo?: unknown }))

  const { data: usuarioObjetivo, error: objetivoError } = await db
    .from('users')
    .select('plan_activo')
    .eq('id', id)
    .single<{ plan_activo: boolean }>()

  if (objetivoError || !usuarioObjetivo) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const planActivo = typeof body.plan_activo === 'boolean'
    ? body.plan_activo
    : !usuarioObjetivo.plan_activo

  const { error: updateError } = await db
    .from('users')
    .update({ plan_activo: planActivo })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plan_activo: planActivo })
}
