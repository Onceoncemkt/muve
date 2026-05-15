export function obtenerWWDRPem(): string | null {
  const base64 = process.env.APPLE_WWDR_PEM_BASE64?.trim()
  if (base64) {
    try {
      return Buffer.from(base64, 'base64').toString('utf8')
    } catch {
      return null
    }
  }
  const pemDirecto = process.env.APPLE_WWDR_PEM?.trim()
  if (pemDirecto) return pemDirecto.replace(/\\n/g, '\n')
  return null
}
