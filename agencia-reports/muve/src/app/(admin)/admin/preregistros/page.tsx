import { createClient } from '@/lib/supabase/server'
import { obtenerRolServidor } from '@/lib/auth/server-role'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminPreregistrosClient from './AdminPreregistrosClient'

export const dynamic = 'force-dynamic'

export default async function AdminPreregistrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rol = await obtenerRolServidor(user)
  if (rol !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">Pre-registros</h1>
          <p className="mt-1 text-xs text-white/50">Lista de espera, filtros y exportación CSV.</p>
        </div>
        <Link
          href="/admin/configuracion"
          className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:border-[#E8FF47] hover:text-[#E8FF47]"
        >
          ← Configuración
        </Link>
      </div>
      <AdminPreregistrosClient />
    </div>
  )
}
