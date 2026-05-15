import { createHmac, timingSafeEqual } from 'crypto'

export function generarAuthenticationToken(userId: string): string | null {
  const secret = process.env.WALLET_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(userId).digest('hex')
}

export function userIdDesdeSerial(serialNumber: string): string {
  return serialNumber.replace(/^muvet-/, '')
}

export function verificarApplePassAuth(
  headerValue: string | null,
  serialNumber: string,
): { ok: boolean; userId: string } {
  const userId = userIdDesdeSerial(serialNumber)
  if (!userId) return { ok: false, userId: '' }
  const expected = generarAuthenticationToken(userId)
  if (!expected) return { ok: false, userId }
  if (!headerValue) return { ok: false, userId }

  const match = headerValue.match(/^ApplePass\s+(.+)$/i)
  const provided = match?.[1]?.trim()
  if (!provided) return { ok: false, userId }

  if (provided.length !== expected.length) return { ok: false, userId }
  const eqExpected = Buffer.from(expected, 'utf8')
  const eqProvided = Buffer.from(provided, 'utf8')
  if (eqExpected.length !== eqProvided.length) return { ok: false, userId }
  try {
    return { ok: timingSafeEqual(eqExpected, eqProvided), userId }
  } catch {
    return { ok: false, userId }
  }
}
