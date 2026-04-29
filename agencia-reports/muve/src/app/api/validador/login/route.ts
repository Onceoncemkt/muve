import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { negocioAccessCode } from '@/lib/negocio-code'

function normalizarNombre(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export async function POST(req: NextRequest) {
  const { codigo_negocio, pin, nombre_validador } = await req.json().catch(() => ({}))

  if (!codigo_negocio || !pin || !nombre_validador) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const supabase = await createClient()
  const codigoNormalizado = String(codigo_negocio).trim().toUpperCase()
  const nombreNormalizado = normalizarNombre(String(nombre_validador))

  const { data: validadores } = await supabase
    .from('validadores')
    .select('id, nombre, pin_hash, negocio_id, negocios(nombre, activo)')
    .eq('activo', true)
    .returns<Array<{
      id: string
      nombre: string
      pin_hash: string
      negocio_id: string
      negocios: { nombre?: string; activo?: boolean } | { nombre?: string; activo?: boolean }[] | null
    }>>()

  if (!validadores?.length) {
    return NextResponse.json({ error: 'Sin validadores configurados' }, { status: 404 })
  }
  const candidatos = validadores.filter((v) => (
    typeof v.negocio_id === 'string'
    && negocioAccessCode(
      String(Array.isArray(v.negocios) ? v.negocios[0]?.nombre ?? '' : v.negocios?.nombre ?? '')
    ) === codigoNormalizado
    && normalizarNombre(v.nombre) === nombreNormalizado
    && (
      (Array.isArray(v.negocios) ? v.negocios[0]?.activo : v.negocios?.activo) === true
    )
  ))

  if (candidatos.length === 0) {
    return NextResponse.json({ error: 'Código o nombre inválidos' }, { status: 401 })
  }

  let validadorMatch: {
    id: string
    nombre: string
    pin_hash: string
    negocio_id: string
    negocios: { nombre?: string; activo?: boolean } | { nombre?: string; activo?: boolean }[] | null
  } | null = null
  for (const v of candidatos) {
    if (await bcrypt.compare(String(pin), v.pin_hash)) {
      validadorMatch = v
      break
    }
  }

  if (!validadorMatch) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }
  const negocio = Array.isArray(validadorMatch.negocios) ? validadorMatch.negocios[0] : validadorMatch.negocios

  await supabase
    .from('validadores')
    .update({ ultima_actividad: new Date().toISOString() })
    .eq('id', validadorMatch.id)

  const cookieStore = await cookies()
  cookieStore.set('muvet_validador', JSON.stringify({
    validador_id: validadorMatch.id,
    negocio_id: validadorMatch.negocio_id,
    nombre: validadorMatch.nombre,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  return NextResponse.json({
    nombre: validadorMatch.nombre,
    negocio_nombre: negocio?.nombre ?? null,
  })
}
