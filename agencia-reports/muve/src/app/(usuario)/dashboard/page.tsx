import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QRDisplay from '@/components/QRDisplay'
import BotonPortal from '@/components/BotonPortal'
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
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Notificación: membresía recién activada por Stripe */}
      {recienActivada && (
        <div className="bg-green-500 px-4 py-3 text-center text-sm font-medium text-white">
          🎉 ¡Membresía activada! Bienvenid@ a MUVE.
        </div>
      )}

      {/* Banner: sin membresía activa */}
      {!planActivo && !recienActivada && (
        <div className="bg-amber-500 px-4 py-3">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-4">
            <p className="text-sm font-medium text-white">
              Tu cuenta está lista. Activa tu membresía para empezar a visitar negocios.
            </p>
            <a
              href="/#planes"
              className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors"
            >
              Ver planes →
            </a>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 pb-8 pt-10 text-white">
        <p className="text-sm font-medium opacity-80">
          📍 {CIUDAD_LABELS[ciudad]}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          ¡Hola, {nombre.split(' ')[0]}! 👋
        </h1>
        <p className="mt-1 text-sm opacity-75">
          {planActivo ? 'Tu membresía MUVE está activa' : 'Bienvenid@ a MUVE'}
        </p>

        <div className="mt-6 flex gap-4">
          <div className="rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
            <p className="text-2xl font-bold">{visitasMes ?? 0}</p>
            <p className="text-xs opacity-80">visitas este mes</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
            <p className="text-2xl font-bold">{totalVisitas ?? 0}</p>
            <p className="text-xs opacity-80">visitas totales</p>
          </div>
        </div>
      </div>

      {/* QR del día */}
      <div className="px-4 -mt-4">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm">
          <h2 className="mb-1 text-center text-lg font-bold text-gray-900">
            Tu QR del día
          </h2>
          <p className="mb-6 text-center text-xs text-gray-400">
            Muéstralo en recepción para registrar tu visita
          </p>
          <QRDisplay />
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <a
          href="/explorar"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:shadow-md transition-shadow"
        >
          <span className="text-3xl">🗺️</span>
          <span className="text-sm font-medium text-gray-700">Explorar negocios</span>
        </a>
        <a
          href="/historial"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:shadow-md transition-shadow"
        >
          <span className="text-3xl">📋</span>
          <span className="text-sm font-medium text-gray-700">Mi historial</span>
        </a>
      </div>

      {/* Gestión de membresía */}
      {planActivo && (
        <div className="mt-4 px-4">
          <BotonPortal className="w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors" />
        </div>
      )}

      {/* CTA suscripción cuando no hay plan */}
      {!planActivo && (
        <div className="mt-4 px-4">
          <a
            href="/#planes"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            Activar membresía →
          </a>
        </div>
      )}
    </div>
  )
}
