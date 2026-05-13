import { createHash } from 'crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizarCiudadOperativa, type Ciudad, type GeneroPerfil, type ObjetivoFitness } from '@/types'
import { PLAN_LABELS, PLAN_VISITAS_MENSUALES, normalizarPlan } from '@/lib/planes'
import PerfilPageClient from './PerfilPageClient'

type PerfilUsuarioCompleto = {
  nombre: string | null
  email: string | null
  ciudad: Ciudad | null
  foto_url: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  genero: GeneroPerfil | null
  objetivo: ObjetivoFitness | null
  plan: string | null
  plan_activo: boolean | string | number | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
  creditos_extra: number | null
  qr_code: string | null
  lesiones: string | null
  objetivo_entrenamiento: string | null
  nivel_condicion: string | null
  disciplinas: string[] | null
  notas_negocio: string | null
}
type PerfilUsuarioMinimo = {
  nombre: string | null
  email: string | null
  ciudad: Ciudad | null
}

const GENEROS_VALIDOS: GeneroPerfil[] = ['masculino', 'femenino', 'prefiero_no_decir']
const OBJETIVOS_VALIDOS: ObjetivoFitness[] = [
  'perder_peso',
  'ganar_musculo',
  'bienestar',
  'flexibilidad',
  'energia',
  'social',
]
const OBJETIVOS_ENTRENAMIENTO_VALIDOS = [
  'perder_peso',
  'ganar_musculo',
  'resistencia',
  'flexibilidad',
  'rehabilitacion',
  'mantenimiento',
  'rendimiento',
] as const
const NIVELES_CONDICION_VALIDOS = ['principiante', 'intermedio', 'avanzado'] as const

type ObjetivoEntrenamientoValido = typeof OBJETIVOS_ENTRENAMIENTO_VALIDOS[number]
type NivelCondicionValido = typeof NIVELES_CONDICION_VALIDOS[number]

function normalizarObjetivoEntrenamiento(value: string | null | undefined): ObjetivoEntrenamientoValido | '' {
  if (!value) return ''
  return OBJETIVOS_ENTRENAMIENTO_VALIDOS.includes(value as ObjetivoEntrenamientoValido)
    ? (value as ObjetivoEntrenamientoValido)
    : ''
}
function normalizarNivelCondicion(value: string | null | undefined): NivelCondicionValido | '' {
  if (!value) return ''
  return NIVELES_CONDICION_VALIDOS.includes(value as NivelCondicionValido)
    ? (value as NivelCondicionValido)
    : ''
}

function esCiudad(value: string | null | undefined): value is Ciudad {
  return normalizarCiudadOperativa(value) !== null
}
function esGenero(value: string | null | undefined): value is GeneroPerfil {
  return Boolean(value && GENEROS_VALIDOS.includes(value as GeneroPerfil))
}
function esObjetivo(value: string | null | undefined): value is ObjetivoFitness {
  return Boolean(value && OBJETIVOS_VALIDOS.includes(value as ObjetivoFitness))
}
function normalizarFechaNacimiento(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}
function parseBooleanSegura(value: unknown): boolean {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'number') return value === 1
  if (typeof value !== 'string') return false
  const normalizado = value.trim().toLowerCase()
  return ['true', '1', 't', 'yes', 'si'].includes(normalizado)
}
function formatearVencimientoWallet(value: string | null | undefined) {
  if (!value) return { fechaVencimiento: undefined, anoVencimiento: undefined }
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return { fechaVencimiento: undefined, anoVencimiento: undefined }
  return {
    fechaVencimiento: new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(fecha),
    anoVencimiento: new Intl.DateTimeFormat('es-MX', { year: 'numeric' }).format(fecha),
  }
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const consultaConEntrenamiento = await supabase
    .from('users')
    .select('nombre, email, ciudad, foto_url, telefono, fecha_nacimiento, genero, objetivo, plan, plan_activo, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code, lesiones, objetivo_entrenamiento, nivel_condicion, disciplinas, notas_negocio')
    .eq('id', user.id)
    .maybeSingle<PerfilUsuarioCompleto>()

  let perfil: PerfilUsuarioCompleto | null = consultaConEntrenamiento.data ?? null

  if (!perfil) {
    const consultaCompleta = await supabase
      .from('users')
      .select('nombre, email, ciudad, foto_url, telefono, fecha_nacimiento, genero, objetivo, plan, plan_activo, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code')
      .eq('id', user.id)
      .maybeSingle<Omit<PerfilUsuarioCompleto, 'lesiones' | 'objetivo_entrenamiento' | 'nivel_condicion' | 'disciplinas' | 'notas_negocio'>>()
    if (consultaCompleta.data) {
      perfil = {
        ...consultaCompleta.data,
        lesiones: null,
        objetivo_entrenamiento: null,
        nivel_condicion: null,
        disciplinas: null,
        notas_negocio: null,
      }
    }
  }

  if (!perfil) {
    const fallbackMinimo = await supabase
      .from('users')
      .select('nombre, email, ciudad')
      .eq('id', user.id)
      .maybeSingle<PerfilUsuarioMinimo>()

    if (fallbackMinimo.data) {
      perfil = {
        ...fallbackMinimo.data,
        foto_url: null,
        telefono: null,
        fecha_nacimiento: null,
        genero: null,
        objetivo: null,
        plan: null,
        plan_activo: null,
        fecha_inicio_ciclo: null,
        fecha_fin_plan: null,
        creditos_extra: 0,
        qr_code: null,
        lesiones: null,
        objetivo_entrenamiento: null,
        nivel_condicion: null,
        disciplinas: null,
        notas_negocio: null,
      }
    }
  }

  const nombreDesdeMetadata = typeof user.user_metadata?.nombre === 'string'
    ? user.user_metadata.nombre
    : null
  const nombre = (perfil?.nombre ?? nombreDesdeMetadata ?? user.email?.split('@')[0] ?? 'Muver').trim()
  const email = user.email ?? perfil?.email ?? ''

  const ciudadRaw = perfil?.ciudad ?? null
  const generoRaw = perfil?.genero ?? null
  const objetivoRaw = perfil?.objetivo ?? null
  const ciudad = esCiudad(ciudadRaw) ? ciudadRaw : 'tulancingo'

  const planNormalizado = normalizarPlan(perfil?.plan ?? null) ?? 'basico'
  const planWallet = PLAN_LABELS[planNormalizado]
  const planActivo = parseBooleanSegura(perfil?.plan_activo)
  const creditosExtra = Math.max(Math.trunc(perfil?.creditos_extra ?? 0), 0)
  const visitasTotales = PLAN_VISITAS_MENSUALES[planNormalizado] + creditosExtra
  const qrCode = perfil?.qr_code || createHash('sha256').update(user.id).digest('hex')
  const { fechaVencimiento, anoVencimiento } = formatearVencimientoWallet(perfil?.fecha_fin_plan)

  let visitasUsadas = 0
  if (planActivo && perfil?.fecha_inicio_ciclo && perfil?.fecha_fin_plan) {
    const { count } = await supabase
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('fecha', perfil.fecha_inicio_ciclo)
      .lte('fecha', perfil.fecha_fin_plan)
    visitasUsadas = count ?? 0
  } else {
    const { count } = await supabase
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    visitasUsadas = count ?? 0
  }

  return (
    <PerfilPageClient
      userId={user.id}
      initialProfile={{
        nombre,
        email,
        ciudad,
        foto_url: perfil?.foto_url ?? null,
        telefono: perfil?.telefono ?? '',
        fecha_nacimiento: normalizarFechaNacimiento(perfil?.fecha_nacimiento),
        genero: esGenero(generoRaw) ? generoRaw : '',
        objetivo: esObjetivo(objetivoRaw) ? objetivoRaw : '',
        lesiones: perfil?.lesiones ?? '',
        objetivo_entrenamiento: normalizarObjetivoEntrenamiento(perfil?.objetivo_entrenamiento),
        nivel_condicion: normalizarNivelCondicion(perfil?.nivel_condicion),
        disciplinas: Array.isArray(perfil?.disciplinas) ? perfil.disciplinas : [],
        notas_negocio: perfil?.notas_negocio ?? '',
      }}
      initialWalletData={{
        plan: planWallet,
        visitasUsadas,
        visitasTotales,
        fechaVencimiento,
        anoVencimiento,
        qrCode,
      }}
    />
  )
}
