import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { enviarPushAUsuarios } from '@/lib/push/server'
import type { Rol } from '@/types'

type CreditosBody = {
  user_id?: unknown
  cantidad?: unknown
  motivo?: unknown
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function parseCantidad(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function faltaColumna(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = admin()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as CreditosBody))
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  const cantidad = parseCantidad(body.cantidad)
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''

  if (!userId) {
    return NextResponse.json({ error: 'user_id es requerido' }, { status: 400 })
  }
  if (!cantidad || cantidad < 1 || cantidad > 50) {
    return NextResponse.json({ error: 'cantidad debe estar entre 1 y 50' }, { status: 400 })
  }
  if (!motivo) {
    return NextResponse.json({ error: 'motivo es requerido' }, { status: 400 })
  }

  const { data: usuarioObjetivo, error: usuarioObjetivoError } = await db
    .from('users')
    .select('id, nombre, creditos_extra')
    .eq('id', userId)
    .maybeSingle<{ id: string; nombre: string | null; creditos_extra: number | null }>()

  if (usuarioObjetivoError || !usuarioObjetivo) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const creditosActuales = Math.max(Math.trunc(usuarioObjetivo.creditos_extra ?? 0), 0)
  const creditosNuevos = creditosActuales + cantidad

  const { error: updateError } = await db
    .from('users')
    .update({ creditos_extra: creditosNuevos })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message ?? 'No se pudo actualizar créditos' }, { status: 500 })
  }

  const insercionHistorial = await db
    .from('creditos_historial')
    .insert({
      user_id: userId,
      cantidad,
      motivo,
      otorgado_por: 'admin',
    })

  if (insercionHistorial.error && faltaColumna(insercionHistorial.error, 'otorgado_por')) {
    const fallback = await db
      .from('creditos_historial')
      .insert({
        user_id: userId,
        cantidad,
        motivo,
      })
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message ?? 'No se pudo guardar historial' }, { status: 500 })
    }
  } else if (insercionHistorial.error) {
    return NextResponse.json({ error: insercionHistorial.error.message ?? 'No se pudo guardar historial' }, { status: 500 })
  }

  await enviarPushAUsuarios(
    [userId],
    {
      title: 'MUVET',
      body: `MUVET te ha regalado ${cantidad} créditos extra. Motivo: ${motivo}`,
      url: '/dashboard',
    }
  )

  return NextResponse.json({
    ok: true,
    user_id: userId,
    cantidad,
    motivo,
    creditos_extra: creditosNuevos,
  })
}
