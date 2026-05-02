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
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8FF47]">Admin</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Pre-registros</h1>
            <p className="mt-1 text-sm text-white/60">Lista de espera, filtros y exportación CSV.</p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:border-[#E8FF47] hover:text-[#E8FF47]"
          >
            Volver al panel
          </Link>
        </div>
        <AdminPreregistrosClient />
      </div>
    </div>
  )
}
