import { cookies } from 'next/headers'

export type ValidadorSession = {
  validador_id: string
  negocio_id: string
  nombre: string
}

export async function getValidadorSession(): Promise<ValidadorSession | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get('muvet_validador')
  if (!cookie) return null
  try {
    return JSON.parse(cookie.value) as ValidadorSession
  } catch {
    return null
  }
}
