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
    <div className="min-h-screen bg-[#F7F7F7] pb-16">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <h1 className="text-2xl font-black tracking-tight text-white">Panel Admin</h1>
        <p className="mt-1 text-sm text-white/40">
          MUVET · {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {[
          { label: 'Usuarios', value: totalUsuarios ?? 0 },
          { label: 'Activos', value: usuariosActivos ?? 0 },
          { label: 'Visitas', value: visitasMes ?? 0 },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-[#E5E5E5] bg-white p-4 text-center">
            <p className="text-2xl font-black text-[#0A0A0A]">{stat.value}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-[#888]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Negocios por ciudad */}
      <div className="px-4">
        <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#888]">
          Negocios por ciudad
        </h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(CIUDAD_LABELS) as Ciudad[]).map(ciudad => (
            <div key={ciudad} className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white px-4 py-3">
              <span className="text-sm font-bold text-[#0A0A0A]">{CIUDAD_LABELS[ciudad]}</span>
              <span className="rounded-lg bg-[#6B4FE8] px-3 py-1 text-xs font-bold text-white">
                {negociosPorCiudad[ciudad] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Por categoría */}
      <div className="mt-6 px-4">
        <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#888]">
          Por categoría
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CATEGORIA_LABELS) as Categoria[]).map(cat => {
            const count = (negocios ?? []).filter(n => n.categoria === cat).length
            return (
              <div key={cat} className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[#888]">{CATEGORIA_LABELS[cat]}</p>
                <p className="mt-1 text-2xl font-black text-[#0A0A0A]">{count}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
