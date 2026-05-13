import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { NivelNegocio, Rol } from '@/types'

const PLANES_VALIDOS: NivelNegocio[] = ['basico', 'plus', 'total']

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

function redireccion(
  request: NextRequest,
  nextPath: string,
  estado: 'ok' | 'error',
  mensaje: string
) {
  const url = new URL(nextPath, request.url)
  url.searchParams.set('negocio_status', estado)
  url.searchParams.set('negocio_msg', mensaje)
  return NextResponse.redirect(url, 303)
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
  const planRaw = typeof formData.get('plan_negocio') === 'string'
    ? (formData.get('plan_negocio') as string).trim().toLowerCase()
    : ''

  if (!PLANES_VALIDOS.includes(planRaw as NivelNegocio)) {
    return redireccion(request, nextPath, 'error', 'Plan inválido. Usa básico, plus o total.')
  }

  const { error } = await db
    .from('negocios')
    .update({ plan_negocio: planRaw })
    .eq('id', id)

  if (error) {
    console.error('[POST /api/admin/negocios/[id]/plan] update error:', error.message)
    return redireccion(request, nextPath, 'error', 'No se pudo actualizar el plan del negocio.')
  }

  return redireccion(request, nextPath, 'ok', 'Plan del negocio actualizado.')
}
