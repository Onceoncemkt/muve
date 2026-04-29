import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { obtenerRolServidor } from '@/lib/auth/server-role'
import ValidadoresPageClient from './ValidadoresPageClient'

export default async function NegocioValidadoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const rol = await obtenerRolServidor(user)
  if (!['staff', 'admin'].includes(rol)) {
    redirect('/dashboard')
  }

  return <ValidadoresPageClient />
}
