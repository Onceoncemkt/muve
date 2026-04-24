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

function resolverNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/admin'
  return value.startsWith('/admin') ? value : '/admin'
}

export async function POST(
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
  const formData = await request.formData()
  const nextPath = resolverNextPath(formData.get('next'))

  const { data: negocioObjetivo, error: negocioError } = await db
    .from('negocios')
    .select('activo')
    .eq('id', id)
    .single<{ activo: boolean }>()

  if (negocioError || !negocioObjetivo) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const { error: updateError } = await db
    .from('negocios')
    .update({ activo: !negocioObjetivo.activo })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL(nextPath, request.url), 303)
}
