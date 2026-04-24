import { format, parse } from "date-fns";
import { generateReceiptForPaymentAction } from "@/modules/receipts/actions";
import { getReceiptsPageData } from "@/modules/receipts/queries";

interface ReceiptsPageProps {
  searchParams?: {
    month?: string;
  };
}

function monthOrDefault(month?: string) {
  if (month) return month;
  return format(new Date(), "yyyy-MM");
}

function formatDate(value: string) {
  return format(new Date(value), "dd/MM/yyyy");
}

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const month = monthOrDefault(searchParams?.month);
  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");
  const data = await getReceiptsPageData(month);
  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Recibos digitales</h2>
        <p className="text-sm text-slate-600">
          Genera recibos con folio automático y descarga PDF con branding de la agencia.
        </p>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[220px_1fr]">
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        />
        <button
          type="submit"
          className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Ver mes
        </button>
      </form>

      <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Recibos generados</h3>
          <p className="text-xs text-slate-500">{monthLabel}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Folio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Concepto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Emisión</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{receipt.folio}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{receipt.clientName}</p>
                    <p className="text-xs text-slate-500">{receipt.clientEmail ?? "Sin correo"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{receipt.concept}</td>
                  <td className="px-4 py-3 text-slate-900">{currency.format(receipt.amount)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(receipt.issueDate)}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/receipts/${receipt.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-700 hover:underline"
                    >
                      Descargar PDF
                    </a>
                  </td>
                </tr>
              ))}
              {!data.receipts.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay recibos generados para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Pagos sin recibo</h3>
          <p className="text-xs text-slate-500">{monthLabel}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Periodo</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Vencimiento</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Estatus</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.pendingPayments.map((payment) => (
                <tr key={payment.paymentId}>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{payment.clientName}</p>
                    <p className="text-xs text-slate-500">{payment.clientEmail ?? "Sin correo"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(payment.dueDate)}</td>
                  <td className="px-4 py-3 text-slate-900">{currency.format(payment.amount)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {payment.status === "paid"
                      ? "Pagado"
                      : payment.status === "overdue"
                        ? "Vencido"
                        : "Pendiente"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={generateReceiptForPaymentAction.bind(null, payment.paymentId)}>
                      <input type="hidden" name="month" value={month} />
                      <button type="submit" className="text-slate-700 hover:underline">
                        Generar recibo
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!data.pendingPayments.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Todos los pagos del mes ya tienen recibo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
