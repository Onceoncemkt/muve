import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CATEGORIA_LABELS } from '@/types'
import { resolverVentanaCiclo } from '@/lib/ciclos'

type HistorialReservacion = {
  id: string
  fecha: string
  estado: 'confirmada' | 'cancelada' | 'completada' | 'no_show'
  horarios: {
    hora_inicio: string
    negocios: {
      nombre: string
      categoria: string
      ciudad: string
    } | null
  } | null
}

type PerfilCiclo = {
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
}
type CreditoHistorialRow = {
  id: string
  cantidad: number
  motivo: string
  created_at: string
}

const CATEGORIA_COLORES: Record<string, string> = {
  gimnasio: '#6B4FE8',
  clases: '#0A0A0A',
  estetica: '#888888',
  restaurante: '#6B4FE8',
}

const ESTADO_LABEL: Record<string, string> = {
  completada: 'Asistió',
  no_show: 'No-show',
  cancelada: 'Canceló',
  confirmada: 'Confirmada',
}

const ESTADO_BADGE: Record<string, string> = {
  completada: 'bg-[#DCFCE7] text-[#166534]',
  no_show: 'bg-[#FEE2E2] text-[#991B1B]',
  cancelada: 'bg-[#F3F4F6] text-[#374151]',
  confirmada: 'bg-[#E8FF47]/50 text-[#0A0A0A]',
}

function fechaYmd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function creditosDescontados(estado: string) {
  return estado === 'cancelada' ? 0 : 1
}

export default async function HistorialPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('users')
    .select('fecha_inicio_ciclo, fecha_fin_plan')
    .eq('id', user.id)
    .maybeSingle<PerfilCiclo>()

  const ciclo = resolverVentanaCiclo({
    fechaInicioCiclo: perfil?.fecha_inicio_ciclo,
    fechaFinPlan: perfil?.fecha_fin_plan,
  })

  const { data: reservaciones } = await supabase
    .from('reservaciones')
    .select('id, fecha, estado, horarios(hora_inicio, negocios(nombre, categoria, ciudad))')
    .eq('user_id', user.id)
    .in('estado', ['completada', 'no_show', 'cancelada'])
    .order('fecha', { ascending: false })
    .limit(50)
    .returns<HistorialReservacion[]>()

  const { count: noShowsCicloCount } = await supabase
    .from('reservaciones')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('estado', 'no_show')
    .gte('fecha', fechaYmd(ciclo.inicio))
    .lte('fecha', fechaYmd(ciclo.fin))

  const noShowsCiclo = noShowsCicloCount ?? 0
  const { data: creditosHistorial } = await supabase
    .from('creditos_historial')
    .select('id, cantidad, motivo, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<CreditoHistorialRow[]>()

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Historial</h1>
        <p className="mt-1 text-sm text-[#888]">
          {reservaciones?.length ?? 0} movimientos registrados
        </p>
        <p className="mt-2 inline-flex rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-bold text-[#991B1B]">
          Este ciclo: {noShowsCiclo} no-shows de 3 permitidos
        </p>
      </div>

      <div className="mt-4 px-4">
        {!reservaciones || reservaciones.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-bold text-[#0A0A0A]">Sin historial aún</p>
            <p className="mt-1 text-sm text-[#888]">Explora los negocios y reserva tu primera clase.</p>
            <a
              href="/explorar"
              className="mt-6 inline-block rounded-lg bg-[#6B4FE8] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#5a3fd6]"
            >
              Explorar negocios
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reservaciones.map((reservacion) => {
              const negocio = reservacion.horarios?.negocios
              const fecha = new Date(`${reservacion.fecha}T${reservacion.horarios?.hora_inicio ?? '00:00:00'}`)
              const categoria = negocio?.categoria ?? ''
              const color = CATEGORIA_COLORES[categoria] ?? '#888'
              const initials = CATEGORIA_LABELS[categoria as keyof typeof CATEGORIA_LABELS]?.slice(0, 3).toUpperCase() ?? 'MOV'
              const estado = reservacion.estado
              const estadoLabel = ESTADO_LABEL[estado] ?? estado
              const badge = ESTADO_BADGE[estado] ?? 'bg-[#F3F4F6] text-[#374151]'
              const creditos = creditosDescontados(estado)

              return (
                <div
                  key={reservacion.id}
                  className="rounded-xl border border-[#E5E5E5] bg-white p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-[#0A0A0A]">
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
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge}`}>
                      {estadoLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#F0F0F0] pt-3 text-xs">
                    <span className="font-semibold text-[#666]">Créditos descontados</span>
                    <span className="font-black text-[#0A0A0A]">{creditos}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-6 px-4">
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#0A0A0A]">
            Créditos extra
          </h2>
          {!creditosHistorial || creditosHistorial.length === 0 ? (
            <p className="mt-2 text-xs text-[#888]">No tienes créditos extra registrados.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {creditosHistorial.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#0A0A0A]">{item.motivo}</p>
                    <p className="text-[11px] text-[#888]">
                      {new Date(item.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-[#6B4FE8]">
                    {item.cantidad >= 0 ? '+' : ''}{item.cantidad}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
