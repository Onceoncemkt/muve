import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Rol } from '@/types'

type InvitacionBody = {
  email?: unknown
  rol?: unknown
  negocio_id?: unknown
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function normalizarEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizarRolInvitable(value: unknown): 'usuario' | 'staff' | null {
  if (typeof value !== 'string') return null
  const rol = value.trim().toLowerCase()
  if (rol === 'usuario' || rol === 'staff') return rol
  return null
}

function normalizarNegocioId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('negocio_id')
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function resolverBaseUrl(request: NextRequest) {
  const desdeEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (desdeEnv) {
    return desdeEnv.replace(/\/+$/, '')
  }
  return request.nextUrl.origin.replace(/\/+$/, '')
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

  const body = await request.json().catch(() => ({} as InvitacionBody))
  const email = normalizarEmail(body.email)
  const rol = normalizarRolInvitable(body.rol)
  const negocioId = normalizarNegocioId(body.negocio_id)

  if (!emailValido(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (!rol) {
    return NextResponse.json({ error: 'Rol inválido para invitación' }, { status: 400 })
  }

  if (rol === 'staff' && negocioId) {
    const { data: negocio, error: negocioError } = await db
      .from('negocios')
      .select('id')
      .eq('id', negocioId)
      .maybeSingle<{ id: string }>()

    if (negocioError || !negocio) {
      return NextResponse.json({ error: 'El negocio seleccionado no existe' }, { status: 400 })
    }
  }

  const redirectTo = `${resolverBaseUrl(request)}/auth/confirm`
  const inviteResult = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      rol,
      negocio_id: rol === 'staff' ? negocioId : null,
    },
  })

  if (inviteResult.error) {
    return NextResponse.json({ error: inviteResult.error.message }, { status: 400 })
  }

  let invitedUserId: string | null = inviteResult.data.user?.id ?? null

  if (!invitedUserId) {
    const { data: usuarioPorEmail } = await db
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle<{ id: string }>()
    invitedUserId = usuarioPorEmail?.id ?? null
  }

  let preasignacionAplicada = rol === 'staff' ? Boolean(negocioId) : true

  if (invitedUserId) {
    const payloadBase: { rol: Rol; plan_activo: boolean } = {
      rol,
      plan_activo: false,
    }

    const payloadConNegocio: { rol: Rol; plan_activo: boolean; negocio_id?: string | null } = {
      ...payloadBase,
    }
    if (rol === 'staff') {
      payloadConNegocio.negocio_id = negocioId
    }

    const updatePrincipal = await db
      .from('users')
      .update(payloadConNegocio)
      .eq('id', invitedUserId)

    if (updatePrincipal.error) {
      if (faltaColumnaNegocioId(updatePrincipal.error) && rol === 'staff') {
        const updateFallback = await db
          .from('users')
          .update(payloadBase)
          .eq('id', invitedUserId)

        if (updateFallback.error) {
          return NextResponse.json({ error: updateFallback.error.message }, { status: 500 })
        }
        preasignacionAplicada = false
      } else {
        return NextResponse.json({ error: updatePrincipal.error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    invited_user_id: invitedUserId,
    redirect_to: redirectTo,
    preasignacion_aplicada: preasignacionAplicada,
  })
}
