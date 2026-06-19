import Link from 'next/link'
import {
  adminDb,
  cargarNegocios,
  cargarFinanzas,
  formatearMonto,
  formatearFecha,
  fechaPagoISO,
  pagoLiquidado,
  aNumero,
} from '@/lib/admin/datos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string; desde?: string; hasta?: string }>
}) {
  const { negocio, desde, hasta } = await searchParams

  const db = adminDb()
  const negociosAfiliados = await cargarNegocios(db)
  const negociosPorId = new Map(negociosAfiliados.map((n) => [n.id, n]))

  const {
    finanzasError,
    inicioSemanaISO,
    finSemanaIncluyenteISO,
    pagosNegocios,
    resumenSemanalNegocios,
    totalSemanaNegocios,
    totalPagadoMes,
    totalPagadoHistorico,
    negocioMasVisitasMes,
    promedioVisitasPorNegocio,
    filtroFinanzasNegocioValido,
    filtroFinanzasDesde,
    filtroFinanzasHasta,
    historialPagosFiltrado,
  } = await cargarFinanzas(db, negociosAfiliados, { negocio, desde, hasta })

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">
            Finanzas
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Resumen semanal, pagos por negocio e historial de transferencias.
          </p>
        </div>
        <p className="text-xs font-semibold text-white/50">
          Semana {formatearFecha(`${inicioSemanaISO}T00:00:00`)} · {formatearFecha(`${finSemanaIncluyenteISO}T00:00:00`)}
        </p>
      </div>

      {finanzasError && (
        <div className="mb-4 rounded-lg border border-[#6B4FE8]/40 bg-[#6B4FE8]/10 px-4 py-3 text-sm text-[#CBBEFF]">
          Algunas métricas financieras no se pudieron calcular: {finanzasError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="glass-card rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
            Total a pagar esta semana
          </p>
          <p className="mt-2 text-2xl font-black text-[#E8FF47]">
            {formatearMonto(totalSemanaNegocios)}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {resumenSemanalNegocios.reduce((acc, row) => acc + row.visitasSemana, 0)} visitas acumuladas.
          </p>
        </article>
        <article className="glass-card rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
            Pagado a negocios este mes
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {formatearMonto(totalPagadoMes)}
          </p>
        </article>
        <article className="glass-card rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
            Pagado histórico
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {formatearMonto(totalPagadoHistorico)}
          </p>
        </article>
        <article className="glass-card rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
            Promedio visitas / negocio
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(promedioVisitasPorNegocio)}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {negocioMasVisitasMes
              ? `Top del mes: ${negocioMasVisitasMes.nombre} (${negocioMasVisitasMes.visitas} visitas)`
              : 'Sin visitas registradas este mes.'}
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
            Resumen semanal por negocio
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Desglose de visitas y monto estimado por negocio para la semana actual.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full border-collapse bg-[#151515]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                  <th className="px-3 py-2.5">Negocio</th>
                  <th className="px-3 py-2.5">Visitas</th>
                  <th className="px-3 py-2.5">Monto</th>
                </tr>
              </thead>
              <tbody>
                {resumenSemanalNegocios.map((row) => (
                  <tr key={`resumen-${row.negocio.id}`} className="border-b border-white/10 text-sm text-white/90">
                    <td className="px-3 py-2.5 font-semibold">{row.negocio.nombre}</td>
                    <td className="px-3 py-2.5">{row.visitasSemana}</td>
                    <td className="px-3 py-2.5 text-[#E8FF47] font-bold">{formatearMonto(row.totalSemana)}</td>
                  </tr>
                ))}
                {resumenSemanalNegocios.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-sm text-white/50">
                      No hay negocios para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
            Métricas generales
          </h3>
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-[#151515] px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Negocio con más visitas del mes</p>
              <p className="mt-1 font-semibold text-white">
                {negocioMasVisitasMes ? negocioMasVisitasMes.nombre : 'Sin datos'}
              </p>
              <p className="text-xs text-white/55">
                {negocioMasVisitasMes ? `${negocioMasVisitasMes.visitas} visitas` : '0 visitas'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#151515] px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Registros de pagos</p>
              <p className="mt-1 font-semibold text-white">{pagosNegocios.length}</p>
              <p className="text-xs text-white/55">
                {historialPagosFiltrado.length} visibles con filtros actuales.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 glass-card rounded-xl p-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
          Tabla de pagos por negocio
        </h3>
        <p className="mt-1 text-xs text-white/50">
          Visitas y monto de la semana actual, último pago realizado y estado de pago de esta semana.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full border-collapse bg-[#151515]">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                <th className="px-3 py-2.5">Negocio</th>
                <th className="px-3 py-2.5">Visitas semana</th>
                <th className="px-3 py-2.5">Monto semana</th>
                <th className="px-3 py-2.5">Último pago</th>
                <th className="px-3 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {resumenSemanalNegocios.map((row) => {
                const fechaUltimoPago = row.ultimoPago
                  ? formatearFecha(row.ultimoPago.created_at ?? `${row.ultimoPago.periodo_fin}T00:00:00`)
                  : '—'

                return (
                  <tr key={`pago-${row.negocio.id}`} className="border-b border-white/10 text-sm text-white/90">
                    <td className="px-3 py-2.5 font-semibold">{row.negocio.nombre}</td>
                    <td className="px-3 py-2.5">{row.visitasSemana}</td>
                    <td className="px-3 py-2.5 text-[#E8FF47] font-bold">{formatearMonto(row.totalSemana)}</td>
                    <td className="px-3 py-2.5 text-white/75">
                      {row.ultimoPago ? (
                        <div>
                          <p className="font-semibold text-white">{formatearMonto(aNumero(row.ultimoPago.total_mxn))}</p>
                          <p className="text-xs text-white/55">{fechaUltimoPago}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                          row.estadoSemana === 'Pagado'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-200'
                        }`}
                      >
                        {row.estadoSemana}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {resumenSemanalNegocios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                    No hay negocios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 glass-card rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">
              Historial de pagos
            </h3>
            <p className="mt-1 text-xs text-white/50">
              Filtra por negocio y rango de fechas de pago.
            </p>
          </div>
          <form action="/admin/finanzas" method="GET" className="grid w-full gap-2 sm:w-auto sm:grid-cols-4">
            <select
              name="negocio"
              defaultValue={filtroFinanzasNegocioValido}
              className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white outline-none focus:border-[#E8FF47]"
            >
              <option value="">Todos los negocios</option>
              {negociosAfiliados.map((negocioItem) => (
                <option key={`filtro-finanzas-${negocioItem.id}`} value={negocioItem.id}>
                  {negocioItem.nombre}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="desde"
              defaultValue={filtroFinanzasDesde}
              className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white outline-none focus:border-[#E8FF47]"
            />
            <input
              type="date"
              name="hasta"
              defaultValue={filtroFinanzasHasta}
              className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white outline-none focus:border-[#E8FF47]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-[#E8FF47] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]"
              >
                Filtrar
              </button>
              <Link
                href="/admin/finanzas"
                className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/75 hover:border-[#E8FF47] hover:text-[#E8FF47]"
              >
                Limpiar
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full border-collapse bg-[#151515]">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                <th className="px-3 py-2.5">Negocio</th>
                <th className="px-3 py-2.5">Periodo</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">Fecha de pago</th>
                <th className="px-3 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historialPagosFiltrado.map((pago) => {
                const negocioPago = negociosPorId.get(pago.negocio_id)
                const fecha = fechaPagoISO(pago)
                const estado = pagoLiquidado(pago.estado) ? 'Pagado' : 'Pendiente'

                return (
                  <tr key={`historial-pago-${pago.id}`} className="border-b border-white/10 text-sm text-white/90">
                    <td className="px-3 py-2.5 font-semibold">{negocioPago?.nombre ?? 'Negocio no disponible'}</td>
                    <td className="px-3 py-2.5 text-white/75">
                      {formatearFecha(`${pago.periodo_inicio}T00:00:00`)} · {formatearFecha(`${pago.periodo_fin}T00:00:00`)}
                    </td>
                    <td className="px-3 py-2.5 text-[#E8FF47] font-bold">{formatearMonto(aNumero(pago.total_mxn))}</td>
                    <td className="px-3 py-2.5 text-white/75">
                      {formatearFecha(fecha ? `${fecha}T00:00:00` : null)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                          estado === 'Pagado'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-200'
                        }`}
                      >
                        {estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {historialPagosFiltrado.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                    No hay pagos que coincidan con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
