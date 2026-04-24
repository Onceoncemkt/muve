import { format, parse } from "date-fns";
import type { PaymentStatus } from "@/types/domain";
import { getPaymentsList } from "@/modules/payments/queries";

interface PaymentsPageProps {
  searchParams?: {
    q?: string;
    status?: PaymentStatus | "all";
    month?: string;
  };
}

const statusStyles: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-rose-100 text-rose-800",
};

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
};

function formatDate(date: string) {
  return format(new Date(date), "dd/MM/yyyy");
}

function monthOrDefault(month?: string) {
  if (month) return month;
  return format(new Date(), "yyyy-MM");
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const status = searchParams?.status ?? "all";
  const q = searchParams?.q ?? "";
  const month = monthOrDefault(searchParams?.month);
  const payments = await getPaymentsList({ q, status, month });
  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Pagos</h2>
        <p className="text-sm text-slate-600">Listado mensual con filtros por estado y búsqueda.</p>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente o correo"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
          <option value="overdue">Vencido</option>
        </select>
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Aplicar filtros
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          Mostrando {payments.length} pagos para {monthLabel}.
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Periodo</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Vencimiento</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Método</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{payment.clientName}</p>
                    <p className="text-xs text-slate-500">{payment.clientEmail ?? "Sin correo"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(payment.dueDate)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    }).format(payment.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{payment.paymentMethod ?? "N/D"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[payment.status]}`}
                    >
                      {statusLabels[payment.status]}
                    </span>
                  </td>
                </tr>
              ))}

              {!payments.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No se encontraron pagos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
