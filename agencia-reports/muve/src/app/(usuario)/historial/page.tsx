import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CATEGORIA_LABELS } from '@/types'
import type { Visita } from '@/types'

const CATEGORIA_COLORES: Record<string, string> = {
  gimnasio:    '#6B4FE8',
  clases:      '#0A0A0A',
  estetica:    '#888888',
  restaurante: '#6B4FE8',
}

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
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Historial</h1>
        <p className="mt-1 text-sm text-[#888]">
          {visitas?.length ?? 0} visitas registradas
        </p>
      </div>

      <div className="mt-4 px-4">
        {!visitas || visitas.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-bold text-[#0A0A0A]">Sin visitas aún</p>
            <p className="mt-1 text-sm text-[#888]">Explora los negocios y empieza a moverte.</p>
            <a
              href="/explorar"
              className="mt-6 inline-block rounded-lg bg-[#6B4FE8] px-6 py-3 text-sm font-bold text-white hover:bg-[#5a3fd6] transition-colors"
            >
              Explorar negocios
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visitas.map(visita => {
              const negocio = visita.negocios
              const fecha = new Date(visita.fecha)
              const categoria = negocio?.categoria ?? ''
              const color = CATEGORIA_COLORES[categoria] ?? '#888'
              const initials = CATEGORIA_LABELS[categoria as keyof typeof CATEGORIA_LABELS]?.slice(0, 3).toUpperCase() ?? 'VIS'

              return (
                <div
                  key={visita.id}
                  className="flex items-center gap-4 rounded-xl border border-[#E5E5E5] bg-white p-4"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0A0A0A] truncate">
                      {negocio?.nombre ?? 'Negocio desconocido'}
                    </p>
                    <p className="text-xs text-[#888]">
                      {fecha.toLocaleDateString('es-MX', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {' · '}
                      {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {visita.validado_por && (
                    <p className="shrink-0 text-xs text-[#888]">{visita.validado_por}</p>
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
