import Link from 'next/link'
import {
  adminDb,
  cargarNegocios,
  cargarFinanzas,
  formatearMonto,
  aFechaIsoDia,
} from '@/lib/admin/datos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function Tarjeta({
  titulo,
  valor,
  sub,
  acento = 'amarillo',
}: {
  titulo: string
  valor: string
  sub?: string
  acento?: 'amarillo' | 'morado'
}) {
  const morado = acento === 'morado'
  return (
    <div className={`glass-card metric-card lift glass-in rounded-2xl p-5 ${morado ? 'metric-purple' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">{titulo}</p>
        <span className={`h-2 w-2 rounded-full ${morado ? 'bg-[#6B4FE8] shadow-[0_0_12px_2px_rgba(107,79,232,0.7)]' : 'bg-[#E8FF47] shadow-[0_0_12px_2px_rgba(232,255,71,0.7)]'}`} />
      </div>
      <p className={`mt-3 text-4xl font-black tracking-tight ${morado ? 'text-[#CBBEFF]' : 'text-[#E8FF47]'}`}>{valor}</p>
      {sub && <p className="mt-1.5 text-xs text-white/55">{sub}</p>}
    </div>
  )
}

export default async function AdminDashboardPage() {
  const db = adminDb()
  const negociosAfiliados = await cargarNegocios(db)
  const finanzas = await cargarFinanzas(db, negociosAfiliados)

  // Usuarios activos hoy = check-ins ('asistio') distintos del día de hoy.
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)
  let usuariosActivosHoy = 0
  const consultaHoy = await db
    .from('visitas')
    .select('user_id, estado')
    .gte('fecha', aFechaIsoDia(hoy))
    .lt('fecha', aFechaIsoDia(manana))
  if (!consultaHoy.error) {
    const ids = new Set(
      ((consultaHoy.data ?? []) as { user_id: string; estado?: string | null }[])
        .filter((v) => (v.estado ?? 'asistio') === 'asistio')
        .map((v) => v.user_id)
    )
    usuariosActivosHoy = ids.size
  }

  const visitasSemana = finanzas.resumenSemanalNegocios.reduce((acc, row) => acc + row.visitasSemana, 0)
  const negociosActivos = negociosAfiliados.filter((n) => n.activo).length
  const totalNegocios = negociosAfiliados.length

  const accesos = [
    { href: '/admin/negocios', label: 'Negocios', desc: 'Alta, edición y Stripe' },
    { href: '/admin/usuarios', label: 'Usuarios', desc: 'Roles, planes y créditos' },
    { href: '/admin/reservaciones', label: 'Reservaciones', desc: 'Gestión y estados' },
    { href: '/admin/finanzas', label: 'Finanzas', desc: 'Pagos a negocios' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#E8FF47]">Panel Admin</h1>
        <p className="mt-1 text-sm text-white/50">
          MUVET · {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {finanzas.finanzasError && (
        <div className="rounded-lg bg-[#6B4FE8]/20 px-4 py-3 text-sm font-semibold text-[#CBBEFF] ring-1 ring-[#6B4FE8]/40">
          Algunas métricas financieras no se pudieron cargar: {finanzas.finanzasError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tarjeta titulo="Usuarios activos hoy" valor={String(usuariosActivosHoy)} sub="Check-ins de hoy" />
        <Tarjeta
          titulo="Pagos a negocios (mes)"
          valor={formatearMonto(finanzas.totalPagadoMes)}
          sub={`Por pagar esta semana: ${formatearMonto(finanzas.totalSemanaNegocios)}`}
          acento="morado"
        />
        <Tarjeta
          titulo="Visitas esta semana"
          valor={String(visitasSemana)}
          sub={finanzas.negocioMasVisitasMes ? `Top del mes: ${finanzas.negocioMasVisitasMes.nombre}` : undefined}
        />
        <Tarjeta titulo="Negocios activos" valor={String(negociosActivos)} sub={`${totalNegocios} registrados`} acento="morado" />
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">Accesos rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accesos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="glass-card lift group rounded-xl p-4"
            >
              <p className="text-sm font-black text-white transition-colors group-hover:text-[#E8FF47]">{a.label}</p>
              <p className="mt-1 text-xs text-white/55">{a.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
