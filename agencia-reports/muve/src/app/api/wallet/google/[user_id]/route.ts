import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

function columnaNoExiste(error: { message?: string } | null | undefined, columna: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(columna.toLowerCase())
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { user_id: userId } = await params
  if (user.id !== userId) {
    return NextResponse.json({ error: 'Sin permisos para este usuario' }, { status: 403 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('users')
    .update({ wallet_google_agregado: true })
    .eq('id', user.id)

  if (columnaNoExiste(error, 'wallet_google_agregado')) {
    return NextResponse.json(
      { error: 'Falta la columna users.wallet_google_agregado. Ejecuta la migración 024 en Supabase.' },
      { status: 500 }
    )
  }

  if (error) {
    console.error('[GET /api/wallet/google/[user_id]]', error)
    return NextResponse.json({ error: 'No se pudo activar Google Wallet' }, { status: 500 })
  }

  const passId = createHash('sha256').update(user.id).digest('hex')
  const walletUrl = `https://wallet.google.com/?pass=${passId}`

  return NextResponse.json({
    ok: true,
    agregado: true,
    plataforma: 'google',
    wallet_url: walletUrl,
  })
}
