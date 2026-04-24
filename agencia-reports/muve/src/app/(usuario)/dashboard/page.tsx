import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QRDisplay from '@/components/QRDisplay'
import BotonPortal from '@/components/BotonPortal'
import MisReservaciones from '@/components/MisReservaciones'
import { CIUDAD_LABELS } from '@/types'
import type { User } from '@/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ membresia?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single<User>()

  const { count: totalVisitas } = await supabase
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const { count: visitasMes } = await supabase
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('fecha', inicioMes.toISOString())

  const nombre = perfil?.nombre ?? user.email?.split('@')[0] ?? 'Muver'
  const ciudad = perfil?.ciudad ?? 'tulancingo'
  const params = await searchParams
  const recienActivada = params.membresia === 'activada'
  const planActivo = perfil?.plan_activo ?? false

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      {/* Membresía recién activada */}
      {recienActivada && (
        <div className="bg-[#6B4FE8] px-4 py-3 text-center text-sm font-bold text-white">
          Membresía activada. Bienvenid@ a MUVET.
        </div>
      )}

      {/* Sin membresía activa */}
      {!planActivo && !recienActivada && (
        <div className="bg-[#E8FF47] px-4 py-3">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-4">
            <p className="text-sm font-bold text-[#0A0A0A]">
              Tu cuenta está lista. Activa tu membresía para empezar.
            </p>
            <Link
              href="/#planes"
              className="shrink-0 rounded-lg bg-[#0A0A0A] px-4 py-1.5 text-xs font-bold text-[#E8FF47] hover:bg-[#222] transition-colors"
            >
              Ver planes
            </Link>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-[#0A0A0A] px-6 pb-8 pt-10 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">
          📍 {CIUDAD_LABELS[ciudad]}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Hola, {nombre.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-white/40">
          {planActivo ? 'Membresía activa' : 'Sin membresía activa'}
        </p>

        <div className="mt-6 flex gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-2xl font-black text-[#E8FF47]">{visitasMes ?? 0}</p>
            <p className="text-xs text-white/40">visitas este mes</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-2xl font-black text-[#E8FF47]">{totalVisitas ?? 0}</p>
            <p className="text-xs text-white/40">visitas totales</p>
          </div>
        </div>
      </div>

      {/* QR del día */}
      <div className="-mt-4 px-4">
        <div className="rounded-xl bg-white px-6 py-8 shadow-sm">
          <h2 className="mb-1 text-center text-base font-black uppercase tracking-wider text-[#0A0A0A]">
            Tu QR del día
          </h2>
          <p className="mb-6 text-center text-xs text-[#888]">
            Muéstralo en recepción para registrar tu visita
          </p>
          <QRDisplay />
        </div>
      </div>

      {/* Mis reservaciones */}
      <MisReservaciones />

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
      {planActivo ? (
        <div className="mt-4 px-4">
          <BotonPortal className="w-full rounded-lg border border-[#E5E5E5] bg-white py-3 text-sm font-semibold text-[#888] transition-colors hover:text-[#0A0A0A]" />
        </div>
      ) : (
        <div className="mt-4 px-4">
          <Link
            href="/#planes"
            className="flex w-full items-center justify-center rounded-lg bg-[#6B4FE8] py-4 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6]"
          >
            Activar membresía
          </Link>
        </div>
      )}
    </div>
  )
}
