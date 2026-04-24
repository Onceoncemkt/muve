import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerRolServidor } from '@/lib/auth/server-role'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const rol = await obtenerRolServidor(user)
  return NextResponse.json({ rol })
}
