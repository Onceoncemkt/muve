import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_BACKUP_COOKIE, IMPERSONACION_COOKIE } from '@/lib/impersonacion'
import type { Rol } from '@/types'

/**
 * GET /api/admin/impersonar-negocio/confirmar?token_hash=...&negocio_id=...
 *
 * Consume el magic link: inicia sesión como el staff del negocio. Antes de hacerlo,
 * verifica que quien abre el enlace es admin y respalda su sesión (en cookie httpOnly)
 * para poder volver sin re-loguearse. Marca la impersonación para mostrar el banner.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash') ?? ''
  const negocioId = request.nextUrl.searchParams.get('negocio_id') ?? ''
  if (!tokenHash) redirect('/login?error=impersonacion')

  const supabase = await createClient()
  const cookieStore = await cookies()

  // 1) Defensa en profundidad: solo un admin con sesión válida puede consumir el enlace.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const service = createServiceClient()
  const { data: perfil } = await service
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()
  if (!perfil || perfil.rol !== 'admin') redirect('/dashboard')

  // 2) Respaldar la sesión del admin (sus propios tokens) para poder volver.
  const { data: sesion } = await supabase.auth.getSession()
  const adminBackup = sesion.session
    ? JSON.stringify({
        access_token: sesion.session.access_token,
        refresh_token: sesion.session.refresh_token,
      })
    : null

  // 3) Iniciar sesión como el staff vía el token del magic link.
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (verifyError) redirect('/login?error=impersonacion')

  // 4) Marcar impersonación + guardar respaldo de la sesión admin.
  const { data: negocio } = await service
    .from('negocios')
    .select('nombre')
    .eq('id', negocioId)
    .maybeSingle<{ nombre: string }>()

  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  }
  cookieStore.set(IMPERSONACION_COOKIE, JSON.stringify({ id: negocioId, nombre: negocio?.nombre ?? 'Negocio' }), base)
  if (adminBackup) cookieStore.set(ADMIN_BACKUP_COOKIE, adminBackup, base)

  redirect('/negocio/dashboard')
}
