import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { logs?: string[] } | null
    if (body?.logs && Array.isArray(body.logs)) {
      for (const line of body.logs) {
        console.log('[apple wallet log]', line)
      }
    }
  } catch {
    /* ignore — Apple expects 200 regardless */
  }
  return new NextResponse(null, { status: 200 })
}
