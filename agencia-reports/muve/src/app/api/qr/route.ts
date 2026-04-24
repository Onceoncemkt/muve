import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export async function GET() {
  // ── 1. Verificar identidad con las cookies de sesión ──────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[/api/qr] getUser error:', authError.message, authError.status)
  }
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  console.log('[/api/qr] usuario autenticado:', user.id)

  // ── 2. Service role para operaciones de BD ────────────────────────────
  // El cliente de sesión (anon key) falla en INSERT si el perfil del usuario
  // no existe en public.users (violación FK). Service role lo bypassa y es
  // seguro porque ya verificamos la identidad con getUser() arriba.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[/api/qr] SUPABASE_SERVICE_ROLE_KEY no configurada en env vars')
    return NextResponse.json(
      { error: 'Configuración de servidor incompleta — falta SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    )
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── 3. Asegurar que el perfil existe en public.users ──────────────────
  // El trigger on_auth_user_created a veces no corre si hubo error en el
  // registro. Sin el perfil, el INSERT en qr_tokens falla con FK violation.
  const { error: profileError } = await db
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email!,
        nombre: (user.user_metadata?.nombre as string | undefined)
          ?? user.email!.split('@')[0],
        ciudad: (user.user_metadata?.ciudad as string | undefined) ?? 'tulancingo',
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (profileError) {
    // No fatal — el usuario probablemente ya existe; continuamos
    console.warn('[/api/qr] profile upsert:', profileError.code, profileError.message)
  }

  // ── 4. Buscar token válido existente ──────────────────────────────────
  const ahora = new Date()

  const { data: tokenExistente, error: selectError } = await db
    .from('qr_tokens')
    .select('token, fecha_expiracion')
    .eq('user_id', user.id)
    .eq('usado', false)
    .gt('fecha_expiracion', ahora.toISOString())
    .order('fecha_expiracion', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    console.error('[/api/qr] select error:', selectError.code, selectError.message, selectError.details)
  }

  if (tokenExistente) {
    console.log('[/api/qr] token existente devuelto')
    return NextResponse.json({
      token: tokenExistente.token,
      fecha_expiracion: tokenExistente.fecha_expiracion,
    })
  }

  // ── 5. Generar nuevo token (24h desde ahora) ──────────────────────────
  const token = randomBytes(24).toString('hex')
  const expiracion = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)

  console.log('[/api/qr] generando token para:', user.id, 'expira:', expiracion.toISOString())

  const { data: nuevoToken, error: insertError } = await db
    .from('qr_tokens')
    .insert({
      user_id: user.id,
      token,
      fecha_expiracion: expiracion.toISOString(),
      usado: false,
    })
    .select('token, fecha_expiracion')
    .single()

  if (insertError || !nuevoToken) {
    console.error('[/api/qr] insert error:', {
      code:    insertError?.code,
      message: insertError?.message,
      details: insertError?.details,
      hint:    insertError?.hint,
    })
    return NextResponse.json(
      {
        error:  'Error al generar token',
        code:   insertError?.code,
        detail: insertError?.message,
        hint:   insertError?.hint,
      },
      { status: 500 }
    )
  }

  console.log('[/api/qr] token generado correctamente')
  return NextResponse.json({
    token: nuevoToken.token,
    fecha_expiracion: nuevoToken.fecha_expiracion,
  })
}
