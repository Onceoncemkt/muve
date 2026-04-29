export type Validador = {
  id: string
  negocio_id: string
  nombre: string
  pin_hash: string
  activo: boolean
  ultima_actividad: string | null
  created_at: string
  updated_at: string
}

export type CheckIn = {
  id: string
  user_id: string
  negocio_id: string
  created_at: string
  exitoso: boolean
  validado_por: string | null
}
