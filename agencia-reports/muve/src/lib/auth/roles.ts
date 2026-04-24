import type { Rol } from '@/types'

export const ROLE_COOKIE_NAME = 'muve_rol'
export const ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
type AuthRoleSource = {
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

const ROLE_ALIASES: Record<string, Rol> = {
  admin: 'admin',
  administrador: 'admin',
  staff: 'staff',
  usuario: 'usuario',
  user: 'usuario',
}

export function normalizarRol(rol: unknown): Rol | null {
  if (typeof rol !== 'string') return null
  const rolNormalizado = rol.trim().toLowerCase()
  return ROLE_ALIASES[rolNormalizado] ?? null
}

export function rolDesdeAuth(user: AuthRoleSource | null | undefined): Rol | null {
  if (!user) return null

  const candidatos = [
    user.app_metadata?.rol,
    user.app_metadata?.role,
    user.user_metadata?.rol,
    user.user_metadata?.role,
  ]

  for (const candidato of candidatos) {
    const rol = normalizarRol(candidato)
    if (rol) return rol
  }

  return null
}

export function panelPorRol(rol: Rol): string {
  if (rol === 'staff') return '/negocio/dashboard'
  if (rol === 'admin') return '/admin'
  return '/dashboard'
}
