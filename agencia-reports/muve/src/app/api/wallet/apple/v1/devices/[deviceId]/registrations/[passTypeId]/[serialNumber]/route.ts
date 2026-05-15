import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verificarApplePassAuth } from '@/lib/wallet/apple-webservice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ deviceId: string; passTypeId: string; serialNumber: string }>
}

type RegisterBody = { pushToken?: string }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { deviceId, passTypeId, serialNumber } = await params
  const auth = verificarApplePassAuth(request.headers.get('authorization'), serialNumber)
  if (!auth.ok) return new NextResponse(null, { status: 401 })

  const expectedPassType = process.env.APPLE_PASS_TYPE_ID?.trim()
  if (expectedPassType && passTypeId !== expectedPassType) {
    return new NextResponse(null, { status: 401 })
  }

  let pushToken = ''
  try {
    const body = await request.json() as RegisterBody
    pushToken = typeof body?.pushToken === 'string' ? body.pushToken.trim() : ''
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  if (!pushToken) return new NextResponse(null, { status: 400 })

  const db = createServiceClient()
  const authHeader = request.headers.get('authorization')?.replace(/^ApplePass\s+/i, '').trim() ?? ''

  const existing = await db
    .from('wallet_registrations')
    .select('id, push_token')
    .eq('device_library_id', deviceId)
    .eq('pass_type_id', passTypeId)
    .eq('serial_number', serialNumber)
    .maybeSingle<{ id: string; push_token: string }>()

  if (existing.data) {
    if (existing.data.push_token === pushToken) {
      return new NextResponse(null, { status: 200 })
    }
    await db
      .from('wallet_registrations')
      .update({ push_token: pushToken, updated_at: new Date().toISOString() })
      .eq('id', existing.data.id)
    return new NextResponse(null, { status: 200 })
  }

  const insert = await db
    .from('wallet_registrations')
    .insert({
      user_id: auth.userId,
      device_library_id: deviceId,
      pass_type_id: passTypeId,
      serial_number: serialNumber,
      push_token: pushToken,
      authentication_token: authHeader,
    })

  if (insert.error) {
    console.error('[apple webservice POST register]', insert.error)
    return new NextResponse(null, { status: 500 })
  }
  return new NextResponse(null, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { deviceId, passTypeId, serialNumber } = await params
  const auth = verificarApplePassAuth(request.headers.get('authorization'), serialNumber)
  if (!auth.ok) return new NextResponse(null, { status: 401 })

  const db = createServiceClient()
  const { error } = await db
    .from('wallet_registrations')
    .delete()
    .eq('device_library_id', deviceId)
    .eq('pass_type_id', passTypeId)
    .eq('serial_number', serialNumber)
  if (error) {
    console.error('[apple webservice DELETE register]', error)
    return new NextResponse(null, { status: 500 })
  }
  return new NextResponse(null, { status: 200 })
}
