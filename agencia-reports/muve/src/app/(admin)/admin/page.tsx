import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CIUDAD_LABELS, CATEGORIA_LABELS } from '@/types'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import StaffNegocioAsignadoSelect from '@/components/admin/StaffNegocioAsignadoSelect'
import NegocioStaffAsignarSelect from '@/components/admin/NegocioStaffAsignarSelect'
import AdminUsuarioRolControl from '@/components/admin/AdminUsuarioRolControl'
import AdminUsuarioPlanToggle from '@/components/admin/AdminUsuarioPlanToggle'
import AdminInvitarUsuarioModal from '@/components/admin/AdminInvitarUsuarioModal'
import AdminInvitarNegocioForm from '@/components/admin/AdminInvitarNegocioForm'
import type { Ciudad, Categoria, NivelNegocio, Rol, ZonaNegocio } from '@/types'
import { obtenerRolServidor } from '@/lib/auth/server-role'

type UsuarioAdmin = {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  rol: Rol
  edad: number | null
  plan_activo: boolean
  negocio_id: string | null
  fecha_registro: string
}

type NegocioAdmin = {
  id: string
  nombre: string
  ciudad: Ciudad
  zona?: ZonaNegocio | null
  nivel?: NivelNegocio
  categoria: Categoria
  direccion: string
  descripcion: string | null
  imagen_url: string | null
  instagram_handle: string | null
  requiere_reserva: boolean
  capacidad_default: number | null
  stripe_account_id: string | null
  activo: boolean
}

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']
const ZONAS: ZonaNegocio[] = ['zona1', 'zona2']
const NIVELES: NivelNegocio[] = ['basico', 'plus', 'total']
const ZONA_LABELS: Record<ZonaNegocio, string> = {
  zona1: 'Zona 1',
  zona2: 'Zona 2',
}
const NIVEL_LABELS: Record<NivelNegocio, string> = {
  basico: 'Básico',
  plus: 'Plus',
  total: 'Total',
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function faltaColumnaRequiereReserva(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column')
    && (
      message.includes('requiere_reserva')
      || message.includes('capacidad_default')
      || message.includes('instagram_handle')
      || message.includes('imagen_url')
      || message.includes('stripe_account_id')
      || message.includes('zona')
      || message.includes('nivel')
    )
}

function faltaColumnaEdad(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('edad')
}

function faltaColumnaNegocioId(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes('negocio_id')
}

function normalizarEdad(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function calcularEdadDesdeFecha(fecha: unknown): number | null {
  if (typeof fecha !== 'string' || !fecha.trim()) return null
  const nacimiento = new Date(fecha)
  if (Number.isNaN(nacimiento.getTime())) return null

  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad -= 1
  }
  return edad > 0 ? edad : null
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio_status?: string; negocio_msg?: string }>
}) {
  const adminPreviewEnabled = process.env.NODE_ENV === 'development' && process.env.PREVIEW_ADMIN === 'true'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!adminPreviewEnabled) {
    if (!user) redirect('/login')
    const rolAdmin = await obtenerRolServidor(user)
    if (rolAdmin !== 'admin') redirect('/dashboard')
  }

  const params = await searchParams
  const negocioStatus = params.negocio_status === 'ok' || params.negocio_status === 'error'
    ? params.negocio_status
    : null
  const negocioMsg = params.negocio_msg?.trim() ?? ''

  const db = admin()

  const consultasUsuarios = [
    {
      select: 'id, nombre, email, ciudad, rol, edad, plan_activo, negocio_id, fecha_registro',
      incluyeNegocioId: true,
    },
    {
      select: 'id, nombre, email, ciudad, rol, plan_activo, negocio_id, fecha_registro',
      incluyeNegocioId: true,
    },
    {
      select: 'id, nombre, email, ciudad, rol, edad, plan_activo, fecha_registro',
      incluyeNegocioId: false,
    },
    {
      select: 'id, nombre, email, ciudad, rol, plan_activo, fecha_registro',
      incluyeNegocioId: false,
    },
  ] as const

  type UsuarioFlexible = Omit<UsuarioAdmin, 'edad' | 'negocio_id'> & {
    edad?: unknown
    negocio_id?: unknown
  }

  let usuarios: UsuarioAdmin[] = []
  let usuariosConNegocioIdDisponible = true

  for (const consulta of consultasUsuarios) {
    const resultado = await db
      .from('users')
      .select(consulta.select)
      .order('fecha_registro', { ascending: false })

    if (!resultado.error) {
      usuariosConNegocioIdDisponible = consulta.incluyeNegocioId
      usuarios = ((resultado.data ?? []) as unknown as UsuarioFlexible[]).map(usuario => ({
        ...usuario,
        edad: normalizarEdad(usuario.edad),
        negocio_id: typeof usuario.negocio_id === 'string' ? usuario.negocio_id : null,
      }))
      break
    }

    const errorPorColumnaOpcional = (
      faltaColumnaEdad(resultado.error)
      || faltaColumnaNegocioId(resultado.error)
    )
    if (!errorPorColumnaOpcional) {
      break
    }
  }

  const consultaNegocios = await db
    .from('negocios')
    .select('id, nombre, ciudad, zona, nivel, categoria, direccion, descripcion, imagen_url, instagram_handle, requiere_reserva, capacidad_default, stripe_account_id, activo')
    .order('ciudad')
    .order('nombre')

  let negociosAfiliados: NegocioAdmin[] = []
  if (!consultaNegocios.error) {
    negociosAfiliados = (consultaNegocios.data ?? []) as NegocioAdmin[]
  } else if (faltaColumnaRequiereReserva(consultaNegocios.error)) {
    type NegocioAdminLegacy = Omit<NegocioAdmin, 'zona' | 'nivel' | 'imagen_url' | 'instagram_handle' | 'requiere_reserva' | 'capacidad_default' | 'stripe_account_id'>
    const fallback = await db
      .from('negocios')
      .select('id, nombre, ciudad, categoria, direccion, descripcion, activo')
      .order('ciudad')
      .order('nombre')

    if (!fallback.error) {
      negociosAfiliados = ((fallback.data ?? []) as NegocioAdminLegacy[]).map(negocio => ({
        ...negocio,
        zona: 'zona1',
        nivel: 'basico',
        imagen_url: null,
        instagram_handle: null,
        requiere_reserva: true,
        capacidad_default: 10,
        stripe_account_id: null,
      }))
    }
  }

  const authUsers = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const edadPorUsuario = new Map<string, number>()
  for (const authUser of authUsers.data?.users ?? []) {
    const metadata = authUser.user_metadata as Record<string, unknown> | undefined
    const edadMetadata = normalizarEdad(metadata?.edad)
      ?? normalizarEdad(metadata?.age)
      ?? calcularEdadDesdeFecha(metadata?.fecha_nacimiento)
      ?? calcularEdadDesdeFecha(metadata?.birthdate)

    if (edadMetadata) {
      edadPorUsuario.set(authUser.id, edadMetadata)
    }
  }

  const usuariosEnriquecidos = usuarios.map(usuario => ({
    ...usuario,
    edad: usuario.edad ?? edadPorUsuario.get(usuario.id) ?? null,
  }))

  const negociosPorId = new Map(negociosAfiliados.map(negocio => [negocio.id, negocio]))
  const negociosOpciones = negociosAfiliados.map(negocio => ({
    id: negocio.id,
    nombre: negocio.nombre,
    activo: negocio.activo,
  }))

  const staffUsuarios = usuariosEnriquecidos.filter(usuario => usuario.rol === 'staff')
  const staffPorNegocio = new Map<string, UsuarioAdmin[]>()
  for (const staff of staffUsuarios) {
    if (!staff.negocio_id) continue
    const actuales = staffPorNegocio.get(staff.negocio_id) ?? []
    actuales.push(staff)
    staffPorNegocio.set(staff.negocio_id, actuales)
  }

  const staffParaAsignar = staffUsuarios.map(staff => ({
    id: staff.id,
    nombre: staff.nombre,
    email: staff.email,
    negocioNombreActual: staff.negocio_id
      ? (negociosPorId.get(staff.negocio_id)?.nombre ?? null)
      : null,
  }))

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-16 text-white">
      <div className="border-b border-white/10 px-4 py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin"
              className="text-lg font-black tracking-tight text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="#usuarios"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Usuarios
              </a>
              <a
                href="#negocios"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Negocios
              </a>
              <Link
                href="/admin"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Inicio
              </Link>
              <BotonCerrarSesion className="shrink-0" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#E8FF47]">Panel Admin</h1>
            <p className="mt-1 text-sm text-white/50">
              MUVET · {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </p>
            {adminPreviewEnabled && (
              <p className="mt-2 inline-flex rounded-md bg-[#E8FF47]/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E8FF47]">
                Preview local
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-4 py-6">
        <section id="usuarios" className="scroll-mt-24">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
                Usuarios
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Gestión completa de clientes, staff y admins.
              </p>
            </div>
            <AdminInvitarUsuarioModal
              negocios={negociosAfiliados.map(negocio => ({ id: negocio.id, nombre: negocio.nombre }))}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full border-collapse bg-[#111111]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Ciudad</th>
                  <th className="px-3 py-3">Rol</th>
                  <th className="px-3 py-3">Edad</th>
                  <th className="px-3 py-3">Plan activo</th>
                  <th className="px-3 py-3">Negocio asignado</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosEnriquecidos.map(usuario => {
                  const negocioAsignado = usuario.negocio_id
                    ? negociosPorId.get(usuario.negocio_id)?.nombre ?? 'No disponible'
                    : 'Sin asignar'

                  return (
                    <tr key={usuario.id} className="border-b border-white/10 align-top text-sm text-white/90">
                      <td className="px-3 py-3 font-semibold">{usuario.nombre}</td>
                      <td className="px-3 py-3 text-white/70">{usuario.email}</td>
                      <td className="px-3 py-3">{CIUDAD_LABELS[usuario.ciudad]}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                            usuario.rol === 'admin'
                              ? 'bg-[#6B4FE8]/25 text-[#CBBEFF]'
                              : usuario.rol === 'staff'
                                ? 'bg-[#E8FF47]/20 text-[#E8FF47]'
                                : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-3 py-3">{usuario.edad ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            usuario.plan_activo
                              ? 'bg-[#E8FF47] text-[#0A0A0A]'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {usuario.plan_activo ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/75">{negocioAsignado}</td>
                      <td className="px-3 py-3">
                        <div className="min-w-[16rem] space-y-2">
                          <AdminUsuarioRolControl userId={usuario.id} rolActual={usuario.rol} />
                          <AdminUsuarioPlanToggle userId={usuario.id} planActivo={usuario.plan_activo} />
                          {usuario.rol === 'staff' && usuariosConNegocioIdDisponible && (
                            <StaffNegocioAsignadoSelect
                              userId={usuario.id}
                              negocioIdActual={usuario.negocio_id}
                              negocioActualNombre={usuario.negocio_id ? (negociosPorId.get(usuario.negocio_id)?.nombre ?? null) : null}
                              opciones={negociosOpciones}
                            />
                          )}
                          {usuario.rol === 'staff' && !usuariosConNegocioIdDisponible && (
                            <p className="text-[11px] font-semibold text-white/45">
                              Asignación de negocio no disponible en este esquema.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {usuariosEnriquecidos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-white/50">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="negocios" className="scroll-mt-24">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
                Negocios afiliados
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Estudios, gimnasios, estéticas y restaurantes.
              </p>
            </div>
            <p className="text-xs font-semibold text-white/50">
              {negociosAfiliados.length} registrados · solo los activos se muestran en /explorar
            </p>
          </div>

          {negocioStatus && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${
                negocioStatus === 'ok'
                  ? 'bg-[#E8FF47]/20 text-[#E8FF47] ring-1 ring-[#E8FF47]/40'
                  : 'bg-[#6B4FE8]/20 text-[#CBBEFF] ring-1 ring-[#6B4FE8]/40'
              }`}
            >
              {negocioMsg || (negocioStatus === 'ok' ? 'Operación realizada.' : 'No se pudo completar la operación.')}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                Lista de negocios existentes
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                      <th className="px-2 py-2">Nombre</th>
                      <th className="px-2 py-2">Categoría</th>
                      <th className="px-2 py-2">Ciudad</th>
                      <th className="px-2 py-2">Zona</th>
                      <th className="px-2 py-2">Nivel</th>
                      <th className="px-2 py-2">Activo</th>
                      <th className="px-2 py-2">Staff asignado</th>
                      <th className="px-2 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negociosAfiliados.map(negocio => {
                      const staffAsignado = staffPorNegocio.get(negocio.id) ?? []

                      return (
                        <tr key={negocio.id} className="border-b border-white/10 align-top text-sm text-white/85">
                          <td className="px-2 py-2">
                            <p className="font-semibold">{negocio.nombre}</p>
                            <p className="mt-0.5 text-xs text-white/45">{negocio.direccion}</p>
                            <p className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              negocio.stripe_account_id
                                ? 'bg-[#E8FF47]/20 text-[#E8FF47]'
                                : 'bg-white/10 text-white/60'
                            }`}>
                              Stripe: {negocio.stripe_account_id ? 'Conectado' : 'Pendiente'}
                            </p>
                          </td>
                          <td className="px-2 py-2">{CATEGORIA_LABELS[negocio.categoria]}</td>
                          <td className="px-2 py-2">{CIUDAD_LABELS[negocio.ciudad]}</td>
                          <td className="px-2 py-2">{ZONA_LABELS[(negocio.zona ?? 'zona1') as ZonaNegocio]}</td>
                          <td className="px-2 py-2">{NIVEL_LABELS[(negocio.nivel ?? 'basico') as NivelNegocio]}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-bold ${
                                negocio.activo
                                  ? 'bg-[#E8FF47] text-[#0A0A0A]'
                                  : 'bg-white/10 text-white/70'
                              }`}
                            >
                              {negocio.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {staffAsignado.length === 0 ? (
                              <span className="text-xs text-white/45">Sin staff asignado</span>
                            ) : (
                              <div className="space-y-1">
                                {staffAsignado.map(staff => (
                                  <p key={staff.id} className="text-xs text-[#E8FF47]">
                                    {staff.nombre}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2">
                                <form method="POST" action={`/api/admin/negocios/${negocio.id}/stripe-connect`}>
                                  <input type="hidden" name="next" value="/admin" />
                                  <button
                                    type="submit"
                                    className="rounded-md bg-[#0A0A0A] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#E8FF47] hover:bg-[#222222]"
                                  >
                                    {negocio.stripe_account_id ? 'Reconectar Stripe' : 'Conectar cuenta Stripe'}
                                  </button>
                                </form>
                                <details>
                                  <summary className="cursor-pointer rounded-md border border-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#CBBEFF] hover:bg-[#6B4FE8]/20">
                                    Editar
                                  </summary>
                                  <div className="mt-2 w-[26rem] max-w-full rounded-lg border border-white/10 bg-[#0A0A0A] p-3">
                                    <form
                                      method="POST"
                                      encType="multipart/form-data"
                                      action={`/api/admin/negocios/${negocio.id}`}
                                      className="grid gap-2 sm:grid-cols-2"
                                    >
                                      <input type="hidden" name="next" value="/admin" />
                                      <div className="sm:col-span-2">
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Nombre
                                        </label>
                                        <input
                                          type="text"
                                          name="nombre"
                                          required
                                          defaultValue={negocio.nombre}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Categoría
                                        </label>
                                        <select
                                          name="categoria"
                                          required
                                          defaultValue={negocio.categoria}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        >
                                          {CATEGORIAS.map(categoria => (
                                            <option key={categoria} value={categoria}>
                                              {CATEGORIA_LABELS[categoria]}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Zona
                                        </label>
                                        <select
                                          name="zona"
                                          required
                                          defaultValue={negocio.zona ?? 'zona1'}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        >
                                          {ZONAS.map(zona => (
                                            <option key={zona} value={zona}>
                                              {ZONA_LABELS[zona]}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Nivel
                                        </label>
                                        <select
                                          name="nivel"
                                          required
                                          defaultValue={negocio.nivel ?? 'basico'}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        >
                                          {NIVELES.map(nivel => (
                                            <option key={nivel} value={nivel}>
                                              {NIVEL_LABELS[nivel]}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Ciudad
                                        </label>
                                        <select
                                          name="ciudad"
                                          required
                                          defaultValue={negocio.ciudad}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        >
                                          {CIUDADES.map(ciudad => (
                                            <option key={ciudad} value={ciudad}>
                                              {CIUDAD_LABELS[ciudad]}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Dirección
                                        </label>
                                        <input
                                          type="text"
                                          name="direccion"
                                          required
                                          defaultValue={negocio.direccion}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        />
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Descripción
                                        </label>
                                        <textarea
                                          name="descripcion"
                                          defaultValue={negocio.descripcion ?? ''}
                                          rows={2}
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Instagram
                                        </label>
                                        <input
                                          type="text"
                                          name="instagram_handle"
                                          defaultValue={negocio.instagram_handle ?? ''}
                                          placeholder="usuario"
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                        />
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                          Foto del negocio
                                        </label>
                                        {negocio.imagen_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={negocio.imagen_url}
                                            alt={negocio.nombre}
                                            className="mb-2 h-28 w-full rounded-md border border-white/10 object-cover"
                                          />
                                        ) : (
                                          <p className="mb-2 text-[10px] text-white/45">Sin foto actual</p>
                                        )}
                                        <input
                                          type="file"
                                          name="foto_negocio"
                                          accept="image/*"
                                          className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-[11px] text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]"
                                        />
                                      </div>
                                      <div className="sm:col-span-2">
                                        <input
                                          id={`requiere-reserva-${negocio.id}`}
                                          type="checkbox"
                                          name="requiere_reserva"
                                          value="true"
                                          defaultChecked={negocio.requiere_reserva}
                                          className="peer h-4 w-4 accent-[#6B4FE8]"
                                        />
                                        <label
                                          htmlFor={`requiere-reserva-${negocio.id}`}
                                          className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-2.5 py-1.5 text-xs text-white/80"
                                        >
                                          Requiere reserva
                                        </label>
                                        <div className="mt-2 hidden peer-checked:block">
                                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">
                                            Capacidad por clase
                                          </label>
                                          <input
                                            type="number"
                                            name="capacidad_default"
                                            min={1}
                                            defaultValue={negocio.capacidad_default ?? 10}
                                            className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]"
                                          />
                                        </div>
                                      </div>
                                      <div className="sm:col-span-2 flex justify-end">
                                        <button
                                          type="submit"
                                          className="rounded-md bg-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#5b40cd]"
                                        >
                                          Guardar cambios
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                </details>

                                <form method="POST" action={`/api/admin/negocios/${negocio.id}/toggle-activo`}>
                                  <input type="hidden" name="next" value="/admin" />
                                  <button
                                    type="submit"
                                    className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                      negocio.activo
                                        ? 'bg-[#6B4FE8] text-white hover:bg-[#5b40cd]'
                                        : 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#d8f03f]'
                                    }`}
                                  >
                                    {negocio.activo ? 'Desactivar' : 'Activar'}
                                  </button>
                                </form>
                              </div>

                              <NegocioStaffAsignarSelect
                                negocioId={negocio.id}
                                opciones={staffParaAsignar}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {negociosAfiliados.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-2 py-4 text-sm text-white/50">
                          No hay negocios registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
                <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                  Agregar negocio nuevo
                </h3>
                <form method="POST" encType="multipart/form-data" action="/api/admin/negocios" className="space-y-3">
                  <input type="hidden" name="next" value="/admin" />
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      required
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                        Categoría
                      </label>
                      <select
                        name="categoria"
                        required
                        defaultValue=""
                        className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                      >
                        <option value="" disabled>Selecciona</option>
                        {CATEGORIAS.map(categoria => (
                          <option key={categoria} value={categoria}>
                            {CATEGORIA_LABELS[categoria]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                        Ciudad
                      </label>
                      <select
                        name="ciudad"
                        required
                        defaultValue=""
                        className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                      >
                        <option value="" disabled>Selecciona</option>
                        {CIUDADES.map(ciudad => (
                          <option key={ciudad} value={ciudad}>
                            {CIUDAD_LABELS[ciudad]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Zona
                    </label>
                    <select
                      name="zona"
                      required
                      defaultValue="zona1"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    >
                      {ZONAS.map(zona => (
                        <option key={zona} value={zona}>
                          {ZONA_LABELS[zona]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Nivel
                    </label>
                    <select
                      name="nivel"
                      required
                      defaultValue="basico"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    >
                      {NIVELES.map(nivel => (
                        <option key={nivel} value={nivel}>
                          {NIVEL_LABELS[nivel]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="direccion"
                      required
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Descripción
                    </label>
                    <textarea
                      name="descripcion"
                      rows={3}
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Instagram
                    </label>
                    <input
                      type="text"
                      name="instagram_handle"
                      placeholder="usuario"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                      Foto del negocio
                    </label>
                    <input
                      type="file"
                      name="foto_negocio"
                      accept="image/*"
                      className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]"
                    />
                  </div>

                  <div>
                    <input
                      id="nuevo-requiere-reserva"
                      type="checkbox"
                      name="requiere_reserva"
                      value="true"
                      defaultChecked
                      className="peer h-4 w-4 accent-[#6B4FE8]"
                    />
                    <label
                      htmlFor="nuevo-requiere-reserva"
                      className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-3 py-1.5 text-sm text-white/80"
                    >
                      Requiere reserva
                    </label>
                    <div className="mt-2 hidden peer-checked:block">
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">
                        Capacidad por clase
                      </label>
                      <input
                        type="number"
                        name="capacidad_default"
                        min={1}
                        defaultValue={10}
                        className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-md bg-[#E8FF47] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]"
                  >
                    Agregar negocio
                  </button>
                </form>
              </div>

              <AdminInvitarNegocioForm
                negocios={negociosAfiliados.map(negocio => ({ id: negocio.id, nombre: negocio.nombre }))}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
