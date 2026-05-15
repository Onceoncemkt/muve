import http2 from 'node:http2'
import forge from 'node-forge'

const APNS_HOST = 'https://api.push.apple.com'

let cachedCredentials: { cert: string; key: string } | null = null

function extraerCertKey(): { cert: string; key: string } {
  if (cachedCredentials) return cachedCredentials
  const p12Base64 = process.env.APPLE_CERT_P12_BASE64?.trim()
  const password = process.env.APPLE_CERT_PASSWORD ?? ''
  if (!p12Base64) throw new Error('Falta APPLE_CERT_P12_BASE64 para APNs')

  const p12Der = forge.util.decode64(p12Base64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

  let cert: forge.pki.Certificate | null = null
  let key: forge.pki.rsa.PrivateKey | null = null
  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) cert = safeBag.cert
      else if (
        (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag
          || safeBag.type === forge.pki.oids.keyBag)
        && safeBag.key
      ) key = safeBag.key as forge.pki.rsa.PrivateKey
    }
  }
  if (!cert || !key) throw new Error('P12 sin cert o llave privada utilizable')

  cachedCredentials = {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(key),
  }
  return cachedCredentials
}

export type ApnsResultado = {
  pushToken: string
  status: number
  reason?: string
  apnsId?: string
}

function postPush(
  client: http2.ClientHttp2Session,
  topic: string,
  pushToken: string,
): Promise<ApnsResultado> {
  return new Promise((resolve) => {
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': topic,
      'apns-push-type': 'background',
      'apns-priority': '5',
      'content-type': 'application/json',
    })

    let status = 0
    let apnsId: string | undefined
    let body = ''

    req.on('response', (headers) => {
      const code = headers[':status']
      status = typeof code === 'number' ? code : 0
      const id = headers['apns-id']
      apnsId = Array.isArray(id) ? id[0] : id
    })
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let reason: string | undefined
      if (body) {
        try {
          const parsed = JSON.parse(body) as { reason?: string }
          reason = parsed.reason
        } catch { /* noop */ }
      }
      resolve({ pushToken, status, reason, apnsId })
    })
    req.on('error', (err) => {
      resolve({ pushToken, status: 0, reason: err.message })
    })
    req.end(JSON.stringify({}))
  })
}

export async function enviarApnsPush(
  pushTokens: string[],
): Promise<ApnsResultado[]> {
  if (pushTokens.length === 0) return []
  const topic = process.env.APPLE_PASS_TYPE_ID?.trim()
  if (!topic) throw new Error('Falta APPLE_PASS_TYPE_ID para APNs')

  const { cert, key } = extraerCertKey()
  const client = http2.connect(APNS_HOST, { cert, key })

  try {
    const resultados = await Promise.all(
      pushTokens.map((token) => postPush(client, topic, token)),
    )
    return resultados
  } finally {
    client.close()
  }
}
