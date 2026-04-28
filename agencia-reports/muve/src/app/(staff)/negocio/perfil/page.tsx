import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { obtenerRolServidor } from '@/lib/auth/server-role'
import NegocioPerfilPageClient from './NegocioPerfilPageClient'

export default async function NegocioPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const rol = await obtenerRolServidor(user)
  if (!['staff', 'admin'].includes(rol)) {
    redirect('/dashboard')
  }

  return <NegocioPerfilPageClient />
}
