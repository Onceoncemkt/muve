import { NextResponse } from 'next/server'
import { getValidadorSession } from '@/lib/validador-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getValidadorSession()
  if (!session) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const supabase = await createClient()
  const { data: negocio } = await supabase
    .from('negocios')
    .select('nombre')
    .eq('id', session.negocio_id)
    .single<{ nombre: string }>()

  return NextResponse.json({ ...session, negocio_nombre: negocio?.nombre ?? null })
}
