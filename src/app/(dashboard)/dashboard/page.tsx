import { KpiCard } from "@/components/dashboard/kpi-card";
import { getDashboardKpis } from "@/modules/dashboard/queries";

export default async function DashboardPage() {
  const kpis = await getDashboardKpis();
  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard principal</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vista general de cobros y estado mensual de clientes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total esperado del mes" value={currency.format(kpis.totalExpectedMonth)} />
        <KpiCard label="Total cobrado" value={currency.format(kpis.totalCollectedMonth)} />
        <KpiCard label="Pagos pendientes" value={String(kpis.pendingPayments)} />
        <KpiCard label="Pagos vencidos" value={String(kpis.overduePayments)} />
        <KpiCard label="Próximos pagos" value={String(kpis.upcomingPayments)} />
      </div>
    </section>
  );
}
