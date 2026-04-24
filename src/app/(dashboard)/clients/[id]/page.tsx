import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/modules/clients/queries";

interface ClientDetailPageProps {
  params: { id: string };
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const client = await getClientDetail(params.id);
  if (!client) notFound();

  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{client.businessName}</h2>
          <p className="text-sm text-slate-600">Detalle de cliente y últimos pagos registrados.</p>
        </div>
        <Link
          href={`/dashboard/clients/${client.id}/edit`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Editar cliente
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Información general</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Razón social</dt>
              <dd className="text-slate-900">{client.legalName ?? "Sin registro"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Contacto</dt>
              <dd className="text-slate-900">{client.contactName ?? "Sin contacto"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Correo</dt>
              <dd className="text-slate-900">{client.email ?? "Sin correo"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Teléfono</dt>
              <dd className="text-slate-900">{client.phone ?? "Sin teléfono"}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Facturación</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Servicio</dt>
              <dd className="text-slate-900">{client.planName ?? "Personalizado"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Monto mensual</dt>
              <dd className="text-slate-900">{currency.format(client.monthlyAmount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Día de pago</dt>
              <dd className="text-slate-900">{client.paymentDay}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Estatus</dt>
              <dd className="text-slate-900">{client.status === "active" ? "Activo" : "Inactivo"}</dd>
            </div>
          </dl>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Notas internas</h3>
        <p className="mt-2 text-sm text-slate-700">{client.notes ?? "Sin notas registradas."}</p>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Pagos recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Vencimiento</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Estatus</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Pagado el</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {client.recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3 text-slate-700">{payment.dueDate}</td>
                  <td className="px-4 py-3 text-slate-900">{currency.format(payment.amount)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {payment.status === "pending"
                      ? "Pendiente"
                      : payment.status === "paid"
                        ? "Pagado"
                        : "Vencido"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{payment.paidAt ?? "—"}</td>
                </tr>
              ))}
              {!client.recentPayments.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Este cliente aún no tiene pagos registrados.
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
