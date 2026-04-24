export type Ciudad = 'tulancingo' | 'pachuca' | 'ensenada' | 'tijuana'
export type Categoria = 'gimnasio' | 'estetica' | 'clases' | 'restaurante'
export type Rol = 'usuario' | 'staff' | 'admin'
export type PlanMembresia = 'basico' | 'plus' | 'total'
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type EstadoReserva = 'confirmada' | 'cancelada' | 'completada'

export interface User {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  plan_activo: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan?: PlanMembresia | null
  rol: Rol
  negocio_id?: string | null
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
  instagram_handle?: string | null
  requiere_reserva?: boolean
  capacidad_default?: number | null
  plan_requerido?: PlanMembresia | null
  activo: boolean
}

export interface Horario {
  id: string
  negocio_id: string
  dia_semana: DiaSemana
  hora_inicio: string   // "HH:MM:SS"
  hora_fin: string
  capacidad_total: number
  activo: boolean
}

export interface Reservacion {
  id: string
  user_id: string
  horario_id: string
  fecha: string         // "YYYY-MM-DD"
  estado: EstadoReserva
  created_at: string
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
  tijuana: 'Tijuana',
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

export const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

// Devuelve la próxima fecha (o hoy) en que ocurre el día de semana dado
export function proximaFecha(dia: DiaSemana): Date {
  const orden: Record<DiaSemana, number> = {
    domingo: 0, lunes: 1, martes: 2, miercoles: 3,
    jueves: 4, viernes: 5, sabado: 6,
  }
  const hoy = new Date()
  const diff = (orden[dia] - hoy.getDay() + 7) % 7
  const fecha = new Date(hoy)
  fecha.setDate(hoy.getDate() + diff)
  return fecha
}

export function formatHora(h: string): string {
  return h.slice(0, 5) // "HH:MM:SS" → "HH:MM"
}
