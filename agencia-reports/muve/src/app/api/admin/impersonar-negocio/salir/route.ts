import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_BACKUP_COOKIE, IMPERSONACION_COOKIE } from '@/lib/impersonacion'

/**
 * GET /api/admin/impersonar-negocio/salir
 *
 * Termina la impersonación: restaura la sesión del admin desde el respaldo (sin
 * re-loguearse) y limpia las cookies. Si no hay respaldo válido, cierra sesión.
 */
export async function GET() {
  const cookieStore = await cookies()
  const backup = cookieStore.get(ADMIN_BACKUP_COOKIE)?.value
  const supabase = await createClient()

  let restaurado = false
  if (backup) {
    try {
      const { access_token, refresh_token } = JSON.parse(backup) as { access_token?: string; refresh_token?: string }
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        restaurado = !error
      }
    } catch {
      restaurado = false
    }
  }

  if (!restaurado) {
    await supabase.auth.signOut()
  }

  cookieStore.delete(IMPERSONACION_COOKIE)
  cookieStore.delete(ADMIN_BACKUP_COOKIE)

  redirect(restaurado ? '/admin/negocios' : '/login')
}
