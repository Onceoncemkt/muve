import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WalletPassCard from '@/components/WalletPassCard'
import WalletButtons from '@/components/wallet/WalletButtons'
import BotonPortal from '@/components/BotonPortal'
import MisReservaciones from '@/components/MisReservaciones'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import PushNotificationsSetup from '@/components/push/PushNotificationsSetup'
import RoleRedirectEffect from './RoleRedirectEffect'
import { CIUDAD_LABELS } from '@/types'
import type { Ciudad, PlanMembresia } from '@/types'
import { obtenerRolServidor } from '@/lib/auth/server-role'
import { PLAN_VISITAS_MENSUALES, normalizarPlan, planDesdePriceId } from '@/lib/planes'
import { stripe } from '@/lib/stripe'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PerfilDashboard = {
  nombre: string
  ciudad: Ciudad
  foto_url?: string | null
  plan_activo: boolean | string | number | null
  plan: PlanMembresia | null
  rol: 'usuario' | 'staff' | 'admin'
  creditos_extra?: number | null
  wallet_apple_agregado?: boolean | null
  wallet_google_agregado?: boolean | null
  fecha_inicio_ciclo?: string | null
  fecha_fin_plan?: string | null
}
type PerfilStripeSuscripcion = {
  stripe_subscription_id: string | null
}
type CreditoHistorialRow = {
  id: string
  cantidad: number
  motivo: string
  created_at: string
}

const PLAN_BADGE_LABEL: Record<PlanMembresia, string> = {
  basico: 'Plan Básico',
  plus: 'Plan Plus',
  total: 'Plan Total',
}
const PLAN_WALLET_LABEL: Record<PlanMembresia, 'BÁSICO' | 'PLUS' | 'TOTAL'> = {
  basico: 'BÁSICO',
  plus: 'PLUS',
  total: 'TOTAL',
}


function formatearFecha(value: Date) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value)
}
function parseFechaSegura(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}
function parseBooleanSegura(value: unknown): boolean | null {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return null
  }
  if (typeof value === 'string') {
    const normalizado = value.trim().toLowerCase()
    if (
      normalizado === 'true'
      || normalizado === '1'
      || normalizado === 't'
      || normalizado === 'yes'
      || normalizado === 'si'
    ) return true
    if (
      normalizado === 'false'
      || normalizado === '0'
      || normalizado === 'f'
      || normalizado === 'no'
    ) return false
  }
  return null
}
function inicialesDesdeNombre(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(fragmento => fragmento[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'MU'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ membresia?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const rol = await obtenerRolServidor(user)
  if (rol === 'admin') redirect('/admin')
  if (rol === 'staff') redirect('/negocio/dashboard')

  const consultaPerfil = await supabase
    .from('users')
    .select('nombre, ciudad, foto_url, plan_activo, plan, rol, creditos_extra, wallet_apple_agregado, wallet_google_agregado, fecha_fin_plan, fecha_inicio_ciclo')
    .eq('id', user.id)
    .single<PerfilDashboard>()
  let perfil = consultaPerfil.data ?? null

  if (!perfil) {
    const fallbackConCiclo = await supabase
      .from('users')
      .select('nombre, ciudad, plan_activo, plan, rol, fecha_fin_plan, fecha_inicio_ciclo')
      .eq('id', user.id)
      .single<Omit<PerfilDashboard, 'creditos_extra'>>()

    if (fallbackConCiclo.data) {
      perfil = {
        ...fallbackConCiclo.data,
        foto_url: null,
        creditos_extra: null,
      }
    }
  }

  if (!perfil) {
    const fallbackMinimo = await supabase
      .from('users')
      .select('nombre, ciudad, plan_activo, plan, rol')
      .eq('id', user.id)
      .single<Omit<PerfilDashboard, 'creditos_extra' | 'fecha_inicio_ciclo' | 'fecha_fin_plan'>>()

    if (fallbackMinimo.data) {
      perfil = {
        ...fallbackMinimo.data,
        foto_url: null,
        creditos_extra: null,
        fecha_inicio_ciclo: null,
        fecha_fin_plan: null,
      }
    }
  }

  const { count: totalVisitas } = await supabase
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const nombre = perfil?.nombre ?? user.email?.split('@')[0] ?? 'Muver'
  const ciudad = perfil?.ciudad ?? 'tulancingo'
  const fotoUrl = typeof perfil?.foto_url === 'string' ? perfil.foto_url : null
  const walletAppleAgregado = parseBooleanSegura(perfil?.wallet_apple_agregado) === true
  const walletGoogleAgregado = parseBooleanSegura(perfil?.wallet_google_agregado) === true
  const inicialesUsuario = inicialesDesdeNombre(nombre)
  const params = await searchParams
  const recienActivada = params.membresia === 'activada'

  let planUsuario = normalizarPlan(perfil?.plan ?? null)
  const planActivoFlag = parseBooleanSegura(perfil?.plan_activo)
  let planActivo = planActivoFlag === true
  if (!planActivo && Boolean(planUsuario)) {
    planActivo = true
  }
  if (!planActivo || !planUsuario) {
    try {
      const { data: perfilStripe } = await supabase
        .from('users')
        .select('stripe_subscription_id')
        .eq('id', user.id)
        .maybeSingle<PerfilStripeSuscripcion>()

      const stripeSubscriptionId = perfilStripe?.stripe_subscription_id
      if (stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
        const stripeActivo = subscription.status === 'active' || subscription.status === 'trialing'
        if (stripeActivo) {
          planActivo = true
          const planStripe = planDesdePriceId(subscription.items.data[0]?.price?.id)
          if (planStripe) {
            planUsuario = planStripe
          }
        }
      }
    } catch (error) {
      console.error('[dashboard] No se pudo resolver membresía por Stripe fallback:', error)
    }
  }
  if (planActivo && !planUsuario) {
    planUsuario = 'basico'
  }

  const hasActiveMembership = planActivo || Boolean(planUsuario)
  const mostrarBannerActivacion = planActivoFlag === false && !hasActiveMembership

  const planActivoLabel = planUsuario ? PLAN_BADGE_LABEL[planUsuario] : null
  const visitasIncluidasPlan = planUsuario ? PLAN_VISITAS_MENSUALES[planUsuario] : 0
  const creditosExtra = Math.max(Math.trunc(perfil?.creditos_extra ?? 0), 0)

  let usadasCiclo = 0
  let cicloActualTexto = '—'
  let cicloNuevoTexto = '—'

  if (planUsuario) {
    const ahora = new Date()
    const inicioCiclo = parseFechaSegura(perfil?.fecha_inicio_ciclo)
      ?? new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)
    const finPlan = parseFechaSegura(perfil?.fecha_fin_plan) ?? ahora
    const finCiclo = finPlan.getTime() > inicioCiclo.getTime() ? finPlan : ahora

    const cicloInicioIso = inicioCiclo.toISOString()
    const cicloFinIso = finCiclo.toISOString()

    const { count: visitasCiclo } = await supabase
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('fecha', cicloInicioIso)
      .lte('fecha', cicloFinIso)

    usadasCiclo = visitasCiclo ?? 0
    cicloActualTexto = `${formatearFecha(inicioCiclo)} — ${formatearFecha(finCiclo)}`
    cicloNuevoTexto = formatearFecha(finCiclo)
  }
  const checkInsRealizados = Math.max(usadasCiclo, 0)
  const visitasDisponibles = visitasIncluidasPlan + creditosExtra
  const visitasRestantes = Math.max(visitasDisponibles - checkInsRealizados, 0)
  const progresoCiclo = visitasDisponibles > 0
    ? Math.min((checkInsRealizados / visitasDisponibles) * 100, 100)
    : 0
  const barraProgresoColor = visitasRestantes <= 1
    ? 'bg-[#EF4444]'
    : visitasRestantes === 2
      ? 'bg-[#FACC15]'
      : 'bg-[#22C55E]'
  const textoRestantesColor = visitasRestantes <= 1
    ? 'text-[#FCA5A5]'
    : visitasRestantes === 2
      ? 'text-[#FDE68A]'
      : 'text-[#86EFAC]'
  const planWallet = planUsuario ? PLAN_WALLET_LABEL[planUsuario] : 'BÁSICO'
  const fechaVencimientoDate = parseFechaSegura(perfil?.fecha_fin_plan)
  const fechaVencimientoWallet = fechaVencimientoDate
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(fechaVencimientoDate)
    : 'Sin fecha'
  const anoVencimientoWallet = fechaVencimientoDate
    ? String(fechaVencimientoDate.getFullYear())
    : '—'
  const qrCodeWallet = `MUVET|${user.id}|${planWallet}|${CIUDAD_LABELS[ciudad]}`

  const consultaCreditosHistorial = await supabase
    .from('creditos_historial')
    .select('id, cantidad, motivo, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8)
    .returns<CreditoHistorialRow[]>()

  const creditosHistorial = consultaCreditosHistorial.error
    ? []
    : (consultaCreditosHistorial.data ?? [])

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <RoleRedirectEffect />
      <PushNotificationsSetup />
      {/* Membresía recién activada */}
      {recienActivada && (
        <div className="bg-[#6B4FE8] px-4 py-3 text-center text-sm font-bold text-white">
          Membresía activada. Bienvenid@ a MUVET.
        </div>
      )}

      {/* Sin membresía activa */}
      {mostrarBannerActivacion && (
        <div className="bg-[#E8FF47] px-4 py-3">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-4">
            <p className="text-sm font-bold text-[#0A0A0A]">
              Tu cuenta está lista. Activa tu membresía para empezar.
            </p>
            <Link
              href="/planes"
              className="shrink-0 rounded-lg bg-[#0A0A0A] px-4 py-1.5 text-xs font-bold text-[#E8FF47] hover:bg-[#222] transition-colors"
            >
              Ver planes
            </Link>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-[#0A0A0A] px-6 pb-8 pt-10 text-white">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">
            {CIUDAD_LABELS[ciudad]}
          </p>
          <BotonCerrarSesion className="shrink-0" />
        </div>
        <div className="mt-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#6B4FE8] text-lg font-black text-white">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="Avatar de perfil" className="h-full w-full object-cover" />
            ) : (
              <span>{inicialesUsuario}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">
              Hola, {nombre.split(' ')[0]}
            </h1>
            <Link
              href="/perfil"
              className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80 transition-colors hover:border-white/50 hover:text-white"
            >
              Ver mi perfil
            </Link>
          </div>
        </div>
        {hasActiveMembership ? (
          <div className="mt-2">
            {planActivoLabel ? (
              <span className="inline-flex rounded-full bg-[#E8FF47] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#0A0A0A]">
                {planActivoLabel}
              </span>
            ) : (
              <p className="text-sm text-white/40">Membresía activa</p>
            )}
            {creditosExtra > 0 && (
              <p className="mt-2 inline-flex rounded-full bg-[#6B4FE8] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
                Tienes {creditosExtra} visitas de regalo
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-white/40">Sin membresía activa</p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 sm:col-span-2">
            <p className="text-xs text-white/40">
              {checkInsRealizados} de {visitasDisponibles} visitas usadas
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${barraProgresoColor}`}
                style={{ width: `${progresoCiclo}%` }}
              />
            </div>
            <p className={`mt-2 text-sm font-bold ${textoRestantesColor}`}>
              Visitas restantes: {visitasRestantes}
            </p>
            {hasActiveMembership && (
              <>
                <p className="mt-2 text-xs text-white/40">Tu ciclo actual: {cicloActualTexto}</p>
                <p className="mt-1 text-xs text-white/40">Ciclo nuevo el {cicloNuevoTexto}</p>
                {creditosExtra > 0 && (
                  <p className="mt-1 text-xs text-[#A78BFA]">
                    Incluye {creditosExtra} visitas extra de regalo.
                  </p>
                )}
                <p className="mt-1 text-[11px] font-semibold text-[#E8FF47]">
                  Los créditos NO se acumulan — al terminar el ciclo se reinician a 0.
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-2xl font-black text-[#E8FF47]">{totalVisitas ?? 0}</p>
            <p className="text-xs text-white/40">visitas totales</p>
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className="-mt-4 px-4">
        <div className="rounded-xl bg-white px-6 py-8 shadow-sm">
          <h2 className="mb-1 text-center text-base font-black uppercase tracking-wider text-[#0A0A0A]">
            Tu pase Wallet
          </h2>
          <p className="mb-6 text-center text-xs text-[#888]">
            Agrégalo para registrar tu visita.
          </p>
          <WalletPassCard
            nombre={nombre}
            plan={planWallet}
            ciudad={CIUDAD_LABELS[ciudad]}
            visitasUsadas={checkInsRealizados}
            visitasTotales={visitasDisponibles}
            fechaVencimiento={fechaVencimientoWallet}
            anoVencimiento={anoVencimientoWallet}
            idSocio={user.id}
            qrCode={qrCodeWallet}
          />
          <div className="mx-auto mt-4 w-full max-w-sm">
            <WalletButtons userId={user.id} />
          </div>
        </div>
      </div>

      {/* Mis reservaciones */}
      <MisReservaciones />

      <div className="mt-4 px-4">
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#0A0A0A]">
            Historial de créditos
          </h3>
          {creditosHistorial.length === 0 ? (
            <p className="mt-2 text-xs text-[#888]">Aún no tienes movimientos de créditos.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {creditosHistorial.map((movimiento) => (
                <div
                  key={movimiento.id}
                  className="flex items-center justify-between rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#0A0A0A]">{movimiento.motivo}</p>
                    <p className="text-[11px] text-[#888]">
                      {new Date(movimiento.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-[#6B4FE8]">
                    {movimiento.cantidad >= 0 ? '+' : ''}{movimiento.cantidad}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <Link
          href="/explorar"
          className="flex flex-col gap-2 rounded-xl border border-[#E5E5E5] bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <span className="text-xs font-black uppercase tracking-widest text-[#6B4FE8]">Explorar</span>
          <span className="text-sm font-semibold text-[#0A0A0A]">Negocios cerca de ti</span>
        </Link>
        <Link
          href="/historial"
          className="flex flex-col gap-2 rounded-xl border border-[#E5E5E5] bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <span className="text-xs font-black uppercase tracking-widest text-[#6B4FE8]">Historial</span>
          <span className="text-sm font-semibold text-[#0A0A0A]">Tus visitas registradas</span>
        </Link>
      </div>

      {/* Gestión de membresía */}
      {hasActiveMembership ? (
        <div className="mt-4 px-4">
          <BotonPortal className="w-full rounded-lg border border-[#E5E5E5] bg-white py-3 text-sm font-semibold text-[#888] transition-colors hover:text-[#0A0A0A]" />
        </div>
      ) : (
        <div className="mt-4 px-4">
          <Link
            href="/planes"
            className="flex w-full items-center justify-center rounded-lg bg-[#6B4FE8] py-4 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6]"
          >
            Activar membresía
          </Link>
        </div>
      )}
    </div>
  )
}
