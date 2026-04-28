import { createHash } from 'crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type Ciudad, type GeneroPerfil, type ObjetivoFitness } from '@/types'
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
}
type PerfilUsuarioMinimo = {
  nombre: string | null
  email: string | null
  ciudad: Ciudad | null
}

const CIUDADES_VALIDAS: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const GENEROS_VALIDOS: GeneroPerfil[] = ['masculino', 'femenino', 'prefiero_no_decir']
const OBJETIVOS_VALIDOS: ObjetivoFitness[] = [
  'perder_peso',
  'ganar_musculo',
  'bienestar',
  'flexibilidad',
  'energia',
  'social',
]

function esCiudad(value: string | null | undefined): value is Ciudad {
  return Boolean(value && CIUDADES_VALIDAS.includes(value as Ciudad))
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

  const consultaCompleta = await supabase
    .from('users')
    .select('nombre, email, ciudad, foto_url, telefono, fecha_nacimiento, genero, objetivo, plan, plan_activo, fecha_inicio_ciclo, fecha_fin_plan, creditos_extra, qr_code')
    .eq('id', user.id)
    .maybeSingle<PerfilUsuarioCompleto>()

  let perfil: PerfilUsuarioCompleto | null = consultaCompleta.data ?? null

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
