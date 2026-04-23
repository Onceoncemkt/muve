import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CATEGORIA_ICONS } from '@/types'
import type { Visita } from '@/types'

export default async function HistorialPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: visitas } = await supabase
    .from('visitas')
    .select('*, negocios(nombre, categoria, ciudad)')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })
    .limit(50)
    .returns<(Visita & { negocios: { nombre: string; categoria: string; ciudad: string } })[]>()

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Mi historial</h1>
        <p className="mt-1 text-sm text-gray-500">
          {visitas?.length ?? 0} visitas registradas
        </p>
      </div>

      <div className="mt-4 px-4">
        {!visitas || visitas.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-4xl">🏃</p>
            <p className="font-medium text-gray-700">Sin visitas aún</p>
            <p className="text-sm text-gray-400">¡Explora los negocios y empieza a moverte!</p>
            <a
              href="/explorar"
              className="mt-4 rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Explorar negocios
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visitas.map(visita => {
              const negocio = visita.negocios
              const fecha = new Date(visita.fecha)
              const icon = negocio?.categoria
                ? CATEGORIA_ICONS[negocio.categoria as keyof typeof CATEGORIA_ICONS] ?? '📍'
                : '📍'

              return (
                <div
                  key={visita.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {negocio?.nombre ?? 'Negocio desconocido'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {fecha.toLocaleDateString('es-MX', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' · '}
                      {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {visita.validado_por && (
                    <p className="shrink-0 text-xs text-gray-400">✓ {visita.validado_por}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
