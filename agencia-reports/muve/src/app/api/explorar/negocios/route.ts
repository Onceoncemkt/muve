import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()
  const consulta = await supabase.from('negocios').select('*').eq('activo', true)

  if (consulta.error) {
    return NextResponse.json(
      { error: consulta.error.message, negocios: [] },
      { status: 500 }
    )
  }

  return NextResponse.json({ negocios: consulta.data ?? [] })
}
