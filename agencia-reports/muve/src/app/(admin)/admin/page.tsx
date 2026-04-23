import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CIUDAD_LABELS, CATEGORIA_LABELS } from '@/types'
import type { Ciudad, Categoria } from '@/types'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const [
    { count: totalUsuarios },
    { count: usuariosActivos },
    { count: visitasMes },
    { data: negocios },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_activo', true),
    supabase.from('visitas').select('id', { count: 'exact', head: true }).gte('fecha', inicioMes.toISOString()),
    supabase.from('negocios').select('id, nombre, ciudad, categoria, activo').eq('activo', true),
  ])

  const negociosPorCiudad = (negocios ?? []).reduce<Record<string, number>>((acc, n) => {
    acc[n.ciudad] = (acc[n.ciudad] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
        <p className="mt-1 text-sm text-gray-500">
          {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Métricas generales */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {[
          { label: 'Usuarios totales', value: totalUsuarios ?? 0, icon: '👥' },
          { label: 'Membresías activas', value: usuariosActivos ?? 0, icon: '✅' },
          { label: 'Visitas este mes', value: visitasMes ?? 0, icon: '📊' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl bg-white p-4 shadow-sm text-center">
            <p className="text-2xl">{stat.icon}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 leading-tight mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Negocios por ciudad */}
      <div className="px-4">
        <h2 className="mb-3 font-semibold text-gray-700">Negocios activos por ciudad</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(CIUDAD_LABELS) as Ciudad[]).map(ciudad => (
            <div
              key={ciudad}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
            >
              <span className="text-sm font-medium text-gray-700">{CIUDAD_LABELS[ciudad]}</span>
              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-sm font-semibold text-indigo-700">
                {negociosPorCiudad[ciudad] ?? 0} negocios
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Negocios por categoría */}
      <div className="mt-6 px-4">
        <h2 className="mb-3 font-semibold text-gray-700">Por categoría</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CATEGORIA_LABELS) as Categoria[]).map(cat => {
            const count = (negocios ?? []).filter(n => n.categoria === cat).length
            return (
              <div key={cat} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-500">{CATEGORIA_LABELS[cat]}</p>
                <p className="text-xl font-bold text-gray-900">{count}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
