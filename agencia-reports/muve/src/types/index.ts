export type Ciudad = 'tulancingo' | 'pachuca' | 'ensenada'
export type Categoria = 'gimnasio' | 'estetica' | 'clases' | 'restaurante'
export type Rol = 'usuario' | 'staff' | 'admin'

export interface User {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  plan_activo: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  rol: Rol
  fecha_registro: string
}

export interface Negocio {
  id: string
  nombre: string
  categoria: Categoria
  ciudad: Ciudad
  direccion: string
  descripcion: string | null
  imagen_url: string | null
  activo: boolean
  visitas_permitidas_por_mes: number
}

export interface Visita {
  id: string
  user_id: string
  negocio_id: string
  fecha: string
  validado_por: string | null
  negocios?: Negocio
}

export interface QRToken {
  id: string
  user_id: string
  token: string
  fecha_expiracion: string
  usado: boolean
}

export const CIUDAD_LABELS: Record<Ciudad, string> = {
  tulancingo: 'Tulancingo',
  pachuca: 'Pachuca',
  ensenada: 'Ensenada',
}

export const CATEGORIA_LABELS: Record<Categoria, string> = {
  gimnasio: 'Gimnasio',
  estetica: 'Estética & Wellness',
  clases: 'Clases',
  restaurante: 'Restaurante Saludable',
}

export const CATEGORIA_ICONS: Record<Categoria, string> = {
  gimnasio: '🏋️',
  estetica: '✨',
  clases: '🧘',
  restaurante: '🥗',
}
