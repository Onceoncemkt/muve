import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CIUDAD_LABELS, CATEGORIA_LABELS } from '@/types'
import { stripe } from '@/lib/stripe'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import StaffNegocioAsignadoSelect from '@/components/admin/StaffNegocioAsignadoSelect'
import type { Ciudad, Categoria, Rol } from '@/types'
import { obtenerRolServidor } from '@/lib/auth/server-role'

type PlanId = 'basico' | 'plus' | 'total'

type PlanConfig = {
  nombre: string
  precioMensual: number
  visitasPorMes: number
}

type StripePlanInfo = {
  priceId: string | null
  unitAmount: number | null
}

type UsuarioAdmin = {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  plan_activo: boolean
  rol: Rol
  negocio_id: string | null
  fecha_registro: string
  stripe_subscription_id: string | null
}

type NegocioAdmin = {
  id: string
  nombre: string
  ciudad: Ciudad
  categoria: Categoria
  direccion: string
  descripcion: string | null
  instagram_handle: string | null
  requiere_reserva: boolean
  capacidad_default: number | null
  activo: boolean
}

type VisitaRaw = {
  id: string
  user_id: string
  negocio_id: string
  fecha: string
  negocios: {
    nombre: string
    ciudad: Ciudad
    categoria: Categoria
  } | {
    nombre: string
    ciudad: Ciudad
    categoria: Categoria
  }[] | null
}

type VisitaDetalle = {
  id: string
  fecha: string
  negocio: string
  ciudad: Ciudad
  categoria: Categoria
}

const PLANES: Record<PlanId, PlanConfig> = {
  basico: { nombre: 'Básico', precioMensual: 549, visitasPorMes: 8 },
  plus: { nombre: 'Plus', precioMensual: 1199, visitasPorMes: 16 },
  total: { nombre: 'Total', precioMensual: 2199, visitasPorMes: 30 },
}

const PRICE_PLAN_MAP: Record<string, PlanId> = {
  [process.env.STRIPE_PRICE_ID_BASICO ?? 'price_1TPWhLRzNt1SyOBv8EYKsGGP']: 'basico',
  [process.env.STRIPE_PRICE_ID_PLUS ?? 'price_1TPS4eRzNt1SyOBv47steWqz']: 'plus',
  [process.env.STRIPE_PRICE_ID_TOTAL ?? 'price_1TPWhgRzNt1SyOBvrA0F50v1']: 'total',
}

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']

function resolverPlan(priceId: string | null | undefined, unitAmount: number | null | undefined): PlanId | null {
  if (priceId && PRICE_PLAN_MAP[priceId]) {
    return PRICE_PLAN_MAP[priceId]
  }

  if (unitAmount === PLANES.basico.precioMensual * 100) return 'basico'
  if (unitAmount === PLANES.plus.precioMensual * 100) return 'plus'
  if (unitAmount === PLANES.total.precioMensual * 100) return 'total'
  return null
}

function normalizarNegocioRelacion(negocio: VisitaRaw['negocios']) {
  if (!negocio) return null
  if (Array.isArray(negocio)) return negocio[0] ?? null
  return negocio
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; negocio_status?: string; negocio_msg?: string }>
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
  const q = params.q?.trim() ?? ''
  const qNormalizada = q.toLowerCase()
  const negocioStatus = params.negocio_status === 'ok' || params.negocio_status === 'error'
    ? params.negocio_status
    : null
  const negocioMsg = params.negocio_msg?.trim() ?? ''

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const inicioMesIso = inicioMes.toISOString()

  const [
    { data: usuariosRaw },
    { data: visitasRaw },
    { data: negocios },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, nombre, email, ciudad, plan_activo, rol, negocio_id, fecha_registro, stripe_subscription_id')
      .order('fecha_registro', { ascending: false }),
    supabase
      .from('visitas')
      .select('id, user_id, negocio_id, fecha, negocios(nombre, ciudad, categoria)')
      .gte('fecha', inicioMesIso)
      .order('fecha', { ascending: false }),
    supabase
      .from('negocios')
      .select('id, nombre, ciudad, categoria, direccion, descripcion, instagram_handle, requiere_reserva, capacidad_default, activo')
      .order('ciudad')
      .order('nombre'),
  ])
  const usuarios = (usuariosRaw ?? []) as UsuarioAdmin[]
  const visitasMes = (visitasRaw ?? []) as VisitaRaw[]
  const negociosAfiliados = (negocios ?? []) as NegocioAdmin[]
  const negociosActivos = negociosAfiliados
    .filter(negocio => negocio.activo)
    .map(negocio => ({ id: negocio.id, nombre: negocio.nombre }))
  const negociosPorId = new Map(negociosAfiliados.map(negocio => [negocio.id, negocio]))

  const subscriptionIds = Array.from(
    new Set(
      usuarios
        .map(u => u.stripe_subscription_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const stripePlanPorSubscription = new Map<string, StripePlanInfo>()

  if (subscriptionIds.length > 0) {
    await Promise.allSettled(
      subscriptionIds.map(async subscriptionId => {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const price = subscription.items.data[0]?.price
        stripePlanPorSubscription.set(subscriptionId, {
          priceId: price?.id ?? null,
          unitAmount: price?.unit_amount ?? null,
        })
      })
    )
  }

  const visitasPorUsuario = new Map<string, VisitaDetalle[]>()
  const conteoVisitasPorUsuario = new Map<string, number>()
  const conteoVisitasPorNegocio = new Map<string, number>()

  for (const visita of visitasMes) {
    const negocio = normalizarNegocioRelacion(visita.negocios)
    if (!negocio) continue

    const detalle: VisitaDetalle = {
      id: visita.id,
      fecha: visita.fecha,
      negocio: negocio.nombre,
      ciudad: negocio.ciudad,
      categoria: negocio.categoria,
    }

    const usuarioVisitas = visitasPorUsuario.get(visita.user_id) ?? []
    usuarioVisitas.push(detalle)
    visitasPorUsuario.set(visita.user_id, usuarioVisitas)

    conteoVisitasPorUsuario.set(
      visita.user_id,
      (conteoVisitasPorUsuario.get(visita.user_id) ?? 0) + 1
    )

    conteoVisitasPorNegocio.set(
      visita.negocio_id,
      (conteoVisitasPorNegocio.get(visita.negocio_id) ?? 0) + 1
    )
  }

  const usuariosEnriquecidos = usuarios.map(usuario => {
    const stripePlanInfo = usuario.stripe_subscription_id
      ? stripePlanPorSubscription.get(usuario.stripe_subscription_id)
      : undefined

    const planId = resolverPlan(
      stripePlanInfo?.priceId ?? null,
      stripePlanInfo?.unitAmount ?? null
    ) ?? 'basico'

    const plan = PLANES[planId]
    const usadasMes = conteoVisitasPorUsuario.get(usuario.id) ?? 0
    const permitidasMes = usuario.plan_activo ? plan.visitasPorMes : 0
    const restantesMes = Math.max(permitidasMes - usadasMes, 0)

    return {
      ...usuario,
      planId,
      plan,
      usadasMes,
      permitidasMes,
      restantesMes,
      detalleVisitas: visitasPorUsuario.get(usuario.id) ?? [],
    }
  })

  const usuariosFiltrados = qNormalizada
    ? usuariosEnriquecidos.filter(usuario =>
      usuario.nombre.toLowerCase().includes(qNormalizada)
      || usuario.email.toLowerCase().includes(qNormalizada)
    )
    : usuariosEnriquecidos

  const totalUsuariosActivos = usuariosEnriquecidos.filter(u => u.plan_activo).length
  const totalUsuariosSinMembresia = usuariosEnriquecidos.length - totalUsuariosActivos
  const ingresosMes = usuariosEnriquecidos
    .filter(u => u.plan_activo)
    .reduce((acc, u) => acc + u.plan.precioMensual, 0)
  const visitasTotalesMes = visitasMes.length


  const nextPath = q ? `/admin?q=${encodeURIComponent(q)}` : '/admin'

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-16 text-white">
      <div className="border-b border-white/10 px-4 py-6">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin"
              className="text-lg font-black tracking-tight text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin#usuarios"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Usuarios
              </Link>
              <Link
                href="/admin#negocios"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Negocios
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
        {/* Métricas generales */}
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/40">
            Métricas generales
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
              { label: 'Total usuarios activos', value: totalUsuariosActivos },
              { label: 'Total usuarios sin membresía', value: totalUsuariosSinMembresia },
              { label: 'Ingresos del mes', value: `$${ingresosMes.toLocaleString('es-MX')}` },
              { label: 'Visitas totales del mes', value: visitasTotalesMes },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl border border-[#6B4FE8]/40 bg-[#131313] p-4"
              >
                <p className="text-2xl font-black text-[#E8FF47]">{stat.value}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Usuarios */}
        <section id="usuarios">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">
              Usuarios
            </h2>
            <form method="GET" className="flex w-full max-w-xl gap-2">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre o email"
                className="w-full rounded-lg border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#6B4FE8]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#E8FF47] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#0A0A0A]"
              >
                Buscar
              </button>
              {q && (
                <a
                  href="/admin"
                  className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70"
                >
                  Limpiar
                </a>
              )}
            </form>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full border-collapse bg-[#111111]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Ciudad</th>
                  <th className="px-3 py-3">Rol</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Plan activo</th>
                  <th className="px-3 py-3">Registro</th>
                  <th className="px-3 py-3">Visitas mes</th>
                  <th className="px-3 py-3">Negocio asignado</th>
                  <th className="px-3 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(usuario => {
                  const negocioAsignado = usuario.negocio_id
                    ? (negociosPorId.get(usuario.negocio_id) ?? null)
                    : null

                  return (
                    <tr key={usuario.id} className="border-b border-white/10 text-sm text-white/90">
                      <td className="px-3 py-3 font-semibold">{usuario.nombre}</td>
                      <td className="px-3 py-3 text-white/70">{usuario.email}</td>
                      <td className="px-3 py-3">{CIUDAD_LABELS[usuario.ciudad]}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${usuario.rol === 'admin'
                            ? 'bg-[#6B4FE8]/25 text-[#CBBEFF]'
                            : usuario.rol === 'staff'
                              ? 'bg-[#E8FF47]/20 text-[#E8FF47]'
                              : 'bg-white/10 text-white/70'
                            }`}
                        >
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-[#6B4FE8]/20 px-2 py-1 text-xs font-bold text-[#CBBEFF]">
                          {usuario.plan.nombre}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${usuario.plan_activo
                            ? 'bg-[#E8FF47] text-[#0A0A0A]'
                            : 'bg-white/10 text-white/70'
                            }`}
                        >
                          {usuario.plan_activo ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/70">{formatearFecha(usuario.fecha_registro)}</td>
                      <td className="px-3 py-3 font-semibold text-[#E8FF47]">
                        {usuario.usadasMes} / {usuario.permitidasMes}
                      </td>
                      <td className="px-3 py-3">
                        {usuario.rol === 'staff' ? (
                          <StaffNegocioAsignadoSelect
                            userId={usuario.id}
                            negocioIdActual={usuario.negocio_id}
                            negocioActualNombre={negocioAsignado?.nombre ?? null}
                            negocioActualActivo={negocioAsignado?.activo ?? false}
                            opciones={negociosActivos}
                          />
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                            No aplica
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <form
                          method="POST"
                          action={`/api/admin/users/${usuario.id}/toggle-plan`}
                        >
                          <input type="hidden" name="next" value={nextPath} />
                          <button
                            type="submit"
                            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${usuario.plan_activo
                              ? 'bg-[#6B4FE8] text-white hover:bg-[#5b40cd]'
                              : 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#d8f03f]'
                              }`}
                          >
                            {usuario.plan_activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
                {usuariosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-sm text-white/50">
                      No se encontraron usuarios con ese criterio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Créditos / visitas */}
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/40">
            Créditos / Visitas
          </h2>
          <div className="space-y-3">
            {usuariosFiltrados.map(usuario => (
              <details
                key={`credito-${usuario.id}`}
                className="rounded-xl border border-white/10 bg-[#111111] p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{usuario.nombre}</p>
                      <p className="text-xs text-white/50">{usuario.email}</p>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#E8FF47]">
                      Quedan {usuario.restantesMes} visitas este mes
                    </p>
                  </div>
                </summary>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                        <th className="px-2 py-2">Fecha</th>
                        <th className="px-2 py-2">Negocio</th>
                        <th className="px-2 py-2">Ciudad</th>
                        <th className="px-2 py-2">Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuario.detalleVisitas.map(visita => (
                        <tr key={visita.id} className="border-b border-white/10 text-sm text-white/85">
                          <td className="px-2 py-2">{formatearFecha(visita.fecha)}</td>
                          <td className="px-2 py-2">{visita.negocio}</td>
                          <td className="px-2 py-2">{CIUDAD_LABELS[visita.ciudad]}</td>
                          <td className="px-2 py-2">{CATEGORIA_LABELS[visita.categoria]}</td>
                        </tr>
                      ))}
                      {usuario.detalleVisitas.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-3 text-sm text-white/50">
                            Sin visitas registradas este mes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Negocios */}
        <section id="negocios">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">
              Negocios
            </h2>
            <p className="text-xs font-semibold text-white/50">
              {negociosAfiliados.length} registrados · solo los activos se muestran en /explorar
            </p>
          </div>

          {negocioStatus && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${negocioStatus === 'ok'
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
                      <th className="px-2 py-2">Instagram</th>
                      <th className="px-2 py-2">Estado</th>
                      <th className="px-2 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negociosAfiliados.map(negocio => (
                      <tr key={negocio.id} className="border-b border-white/10 align-top text-sm text-white/85">
                        <td className="px-2 py-2">
                          <p className="font-semibold">{negocio.nombre}</p>
                          <p className="mt-0.5 text-xs text-white/45">{negocio.direccion}</p>
                        </td>
                        <td className="px-2 py-2">{CATEGORIA_LABELS[negocio.categoria]}</td>
                        <td className="px-2 py-2">{CIUDAD_LABELS[negocio.ciudad]}</td>
                        <td className="px-2 py-2 text-[#CBBEFF]">
                          {negocio.instagram_handle ? `@${negocio.instagram_handle}` : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-bold ${negocio.activo
                              ? 'bg-[#E8FF47] text-[#0A0A0A]'
                              : 'bg-white/10 text-white/70'
                              }`}
                          >
                            {negocio.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <details>
                                <summary className="cursor-pointer rounded-md border border-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#CBBEFF] hover:bg-[#6B4FE8]/20">
                                  Editar
                                </summary>
                                <div className="mt-2 w-[26rem] max-w-full rounded-lg border border-white/10 bg-[#0A0A0A] p-3">
                                  <form
                                    method="POST"
                                    action={`/api/admin/negocios/${negocio.id}`}
                                    className="grid gap-2 sm:grid-cols-2"
                                  >
                                    <input type="hidden" name="next" value={nextPath} />
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
                                <input type="hidden" name="next" value={nextPath} />
                                <button
                                  type="submit"
                                  className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${negocio.activo
                                    ? 'bg-[#6B4FE8] text-white hover:bg-[#5b40cd]'
                                    : 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#d8f03f]'
                                    }`}
                                >
                                  {negocio.activo ? 'Desactivar' : 'Activar'}
                                </button>
                              </form>
                            </div>
                            <p className="text-[11px] text-white/45">
                              Visitas del mes: {conteoVisitasPorNegocio.get(negocio.id) ?? 0}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {negociosAfiliados.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-4 text-sm text-white/50">
                          No hay negocios registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#E8FF47]">
                Agregar negocio nuevo
              </h3>
              <form method="POST" action="/api/admin/negocios" className="space-y-3">
                <input type="hidden" name="next" value={nextPath} />
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
          </div>
        </section>
      </div>
    </div>
  )
}
