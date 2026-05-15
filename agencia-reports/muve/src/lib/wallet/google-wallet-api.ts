import { createSign } from 'crypto'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const WALLET_API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1'
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'

type ServiceAccountCreds = { clientEmail: string; privateKey: string }

function obtenerEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return ''
}

function parseServiceAccountKey(raw: string): ServiceAccountCreds {
  if (!raw) return { clientEmail: '', privateKey: '' }
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { private_key?: string; client_email?: string }
      return {
        privateKey: (json.private_key ?? '').replace(/\\n/g, '\n'),
        clientEmail: typeof json.client_email === 'string' ? json.client_email : '',
      }
    } catch {
      return { clientEmail: '', privateKey: '' }
    }
  }
  return { clientEmail: '', privateKey: trimmed.replace(/\\n/g, '\n') }
}

function obtenerCredenciales(): ServiceAccountCreds {
  const raw = obtenerEnv('GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_WALLET_PRIVATE_KEY')
  const parsed = parseServiceAccountKey(raw)
  const emailEnv = obtenerEnv(
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_WALLET_CLIENT_EMAIL',
  )
  return {
    clientEmail: emailEnv || parsed.clientEmail,
    privateKey: parsed.privateKey,
  }
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function firmarOAuthJwt(creds: ServiceAccountCreds): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    iss: creds.clientEmail,
    scope: SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${payload}`
  const signature = createSign('RSA-SHA256').update(unsigned).end().sign(creds.privateKey)
  return `${unsigned}.${base64UrlEncode(signature)}`
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function obtenerAccessToken(): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > ahora) {
    return cachedToken.token
  }

  const creds = obtenerCredenciales()
  if (!creds.clientEmail || !creds.privateKey) {
    throw new Error('Google service account no configurado')
  }

  const jwt = firmarOAuthJwt(creds)
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`OAuth token error ${response.status}: ${text}`)
  }
  const data = await response.json() as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: ahora + data.expires_in,
  }
  return data.access_token
}

export type PatchGenericObjectInput = {
  objectId: string
  textModulesData: Array<{ id: string; header: string; body: string }>
}

export type PatchResult = {
  ok: boolean
  status: number
  error?: string
}

export async function patchGenericObject(input: PatchGenericObjectInput): Promise<PatchResult> {
  try {
    const token = await obtenerAccessToken()
    const url = `${WALLET_API_BASE}/genericObject/${encodeURIComponent(input.objectId)}`
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textModulesData: input.textModulesData }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, status: response.status, error: text }
    }
    return { ok: true, status: response.status }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return { ok: false, status: 0, error: message }
  }
}
