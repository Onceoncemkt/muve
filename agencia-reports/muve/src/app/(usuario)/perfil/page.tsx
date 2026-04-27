import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Ciudad, GeneroPerfil, ObjetivoFitness } from '@/types'
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

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const consultaCompleta = await supabase
    .from('users')
    .select('nombre, email, ciudad, foto_url, telefono, fecha_nacimiento, genero, objetivo')
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

  return (
    <PerfilPageClient
      userId={user.id}
      initialProfile={{
        nombre,
        email,
        ciudad: esCiudad(ciudadRaw) ? ciudadRaw : 'tulancingo',
        foto_url: perfil?.foto_url ?? null,
        telefono: perfil?.telefono ?? '',
        fecha_nacimiento: normalizarFechaNacimiento(perfil?.fecha_nacimiento),
        genero: esGenero(generoRaw) ? generoRaw : '',
        objetivo: esObjetivo(objetivoRaw) ? objetivoRaw : '',
      }}
    />
  )
}
