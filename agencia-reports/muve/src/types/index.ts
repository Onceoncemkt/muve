export type Ciudad = 'tulancingo' | 'pachuca' | 'ensenada' | 'tijuana'
export type ZonaNegocio = 'zona1' | 'zona2'
export type Categoria = 'gimnasio' | 'estetica' | 'clases' | 'restaurante'
export type Rol = 'usuario' | 'staff' | 'admin'
export type PlanMembresia = 'basico' | 'plus' | 'total'
export type NivelNegocio = 'basico' | 'plus' | 'total'
export type GeneroPerfil = 'masculino' | 'femenino' | 'prefiero_no_decir'
export type ObjetivoFitness = 'perder_peso' | 'ganar_musculo' | 'bienestar' | 'flexibilidad' | 'energia' | 'social'
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type EstadoReserva = 'confirmada' | 'cancelada' | 'completada' | 'no_show'
export type EstadoVisita = 'asistio' | 'no_show' | 'cancelado'
export type EstadoPreregistro = 'pendiente' | 'convertido' | 'cancelado'
export interface ServicioNegocio {
  id: string
  negocio_id: string
  nombre: string
  precio_normal_mxn: number
  descripcion: string | null
  activo: boolean
}

export type Preregistro = {
  id: string
  email: string
  ciudad: string
  nombre: string | null
  codigo_descuento: string
  estado: EstadoPreregistro
  user_id: string | null
  story_url: string | null
  created_at: string
  notificado_lanzamiento_at: string | null
  convertido_at: string | null
}

export interface User {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  foto_url?: string | null
  telefono?: string | null
  fecha_nacimiento?: string | null
  genero?: GeneroPerfil | null
  objetivo?: ObjetivoFitness | null
  plan_activo: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan?: PlanMembresia | null
  creditos_extra?: number | null
  wallet_apple_agregado?: boolean | null
  wallet_google_agregado?: boolean | null
  fecha_inicio_ciclo?: string | null
  fecha_fin_plan?: string | null
  reservas_suspendidas_hasta?: string | null
  rol: Rol
  negocio_id?: string | null
  fecha_registro: string
}

export interface Negocio {
  id: string
  nombre: string
  categoria: Categoria
  ciudad: Ciudad
  zona?: ZonaNegocio | null
  direccion: string
  descripcion: string | null
  oferta_descripcion?: string | null
  imagen_url: string | null
  instagram_handle?: string | null
  tiktok_handle?: string | null
  logo_url?: string | null
  mostrar_en_landing?: boolean
  telefono_contacto?: string | null
  email_contacto?: string | null
  horario_atencion?: string | null
  stripe_account_id?: string | null
  monto_maximo_visita?: number | null
  servicios_incluidos?: string | null
  servicios_disponibles?: ServicioNegocio[]
  requiere_reserva?: boolean
  capacidad_default?: number | null
  plan_requerido?: PlanMembresia | null
  nivel?: NivelNegocio
  activo: boolean
}

export interface Horario {
  id: string
  negocio_id: string
  dia_semana: DiaSemana
  hora_inicio: string   // "HH:MM:SS"
  hora_fin: string
  nombre_coach: string | null
  tipo_clase: string | null
  capacidad_total: number
  activo: boolean
}

export interface Reservacion {
  id: string
  user_id: string
  horario_id: string
  fecha: string         // "YYYY-MM-DD"
  estado: EstadoReserva
  servicio_id?: string | null
  servicio_nombre?: string | null
  servicio_precio_normal_mxn?: number | null
  created_at: string
}

export interface Visita {
  id: string
  user_id: string
  negocio_id: string
  fecha: string
  validado_por: string | null
  plan_usuario?: PlanMembresia | null
  estado?: EstadoVisita
  negocios?: Negocio
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
  restaurante: 'Restaurante',
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
  if (!h) return ''
  const [horasRaw, minutosRaw] = h.split(':')
  const horas = Number.parseInt(horasRaw, 10)
  const minutos = (minutosRaw ?? '00').padStart(2, '0')
  if (!Number.isFinite(horas)) return h.slice(0, 5)
  const ampm = horas >= 12 ? 'PM' : 'AM'
  const horas12 = horas % 12 || 12
  return `${horas12}:${minutos} ${ampm}`
}
