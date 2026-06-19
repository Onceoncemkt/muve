import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Rol } from '@/types'

/**
 * POST /api/admin/impersonar-negocio  { negocio_id }
 *
 * Solo admin. Busca el primer staff/validador del negocio y genera un magic-link
 * de un solo uso. Devuelve la URL de confirmación que, al abrirse, inicia sesión
 * como ese staff (con respaldo de la sesión del admin para poder volver).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const service = createServiceClient()
  const { data: perfil } = await service
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()
  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as { negocio_id?: unknown }))
  const negocioId = typeof body.negocio_id === 'string' ? body.negocio_id.trim() : ''
  if (!negocioId) return NextResponse.json({ error: 'Falta negocio_id' }, { status: 400 })

  // Primer staff/validador asignado al negocio.
  const { data: staff, error: staffError } = await service
    .from('users')
    .select('id, email, nombre')
    .eq('negocio_id', negocioId)
    .in('rol', ['staff', 'validador'])
    .order('rol', { ascending: true }) // 'staff' antes que 'validador'
    .limit(1)
    .maybeSingle<{ id: string; email: string | null; nombre: string | null }>()

  if (staffError) {
    return NextResponse.json({ error: staffError.message ?? 'Error al buscar staff' }, { status: 500 })
  }
  if (!staff || !staff.email) {
    return NextResponse.json({ error: 'Este negocio no tiene staff asignado aún' }, { status: 404 })
  }

  // Magic link de un solo uso para ese staff.
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: staff.email,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return NextResponse.json({ error: linkError?.message ?? 'No se pudo generar el acceso temporal' }, { status: 500 })
  }

  const url = `/api/admin/impersonar-negocio/confirmar?token_hash=${encodeURIComponent(tokenHash)}&negocio_id=${encodeURIComponent(negocioId)}`
  return NextResponse.json({ url, staff_nombre: staff.nombre ?? staff.email })
}
