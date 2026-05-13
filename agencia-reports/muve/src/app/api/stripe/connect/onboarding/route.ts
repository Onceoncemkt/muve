import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  crearOReutilizarCuentaYAccountLink,
  obtenerPerfilAcceso,
  resolverNegocioParaStripe,
} from '@/lib/stripe-connect'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioResult = await resolverNegocioParaStripe(perfil, searchParams.get('negocio_id'))
  if (!negocioResult.ok) {
    return NextResponse.json({ error: negocioResult.error }, { status: negocioResult.status })
  }

  const linkResult = await crearOReutilizarCuentaYAccountLink(request.url, negocioResult.negocio, perfil.rol)
  if (!linkResult.ok) {
    return NextResponse.json({ error: linkResult.error }, { status: linkResult.status })
  }

  return NextResponse.json({ url: linkResult.url })
}
