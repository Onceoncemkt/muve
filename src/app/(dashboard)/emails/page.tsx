import { format, parse } from "date-fns";
import { sendReceiptEmailAction } from "@/modules/emails/actions";
import { getEmailCenterData } from "@/modules/emails/queries";

interface EmailsPageProps {
  searchParams?: {
    month?: string;
  };
}

function monthOrDefault(month?: string) {
  if (month) return month;
  return format(new Date(), "yyyy-MM");
}

function statusLabel(status: "queued" | "sent" | "failed") {
  if (status === "sent") return "Enviado";
  if (status === "failed") return "Fallido";
  return "En cola";
}

export default async function EmailsPage({ searchParams }: EmailsPageProps) {
  const month = monthOrDefault(searchParams?.month);
  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");
  const data = await getEmailCenterData(month);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Envío de correos</h2>
        <p className="text-sm text-slate-600">
          Envía recibos PDF con asunto y mensaje editable y guarda historial de envíos.
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
          <h3 className="text-sm font-semibold text-slate-900">Recibos listos para enviar</h3>
          <p className="text-xs text-slate-500">{monthLabel}</p>
        </div>
        <div className="space-y-4 p-4">
          {data.receipts.map((receipt) => (
            <form
              key={receipt.receiptId}
              action={sendReceiptEmailAction.bind(null, receipt.receiptId)}
              className="space-y-3 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {receipt.clientName} · {receipt.folio}
                  </p>
                  <p className="text-xs text-slate-500">
                    Periodo: {receipt.periodStart} a {receipt.periodEnd}
                  </p>
                </div>
              </div>

              <input type="hidden" name="month" value={month} />

              <label className="block space-y-1">
                <span className="text-sm text-slate-600">Para</span>
                <input
                  name="toEmail"
                  defaultValue={receipt.clientEmail ?? ""}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-slate-600">Asunto</span>
                <input
                  name="subject"
                  defaultValue={`Recibo de pago correspondiente a ${monthLabel}`}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-slate-600">Mensaje</span>
                <textarea
                  name="body"
                  defaultValue={`Hola ${receipt.clientName},\n\nAdjuntamos tu recibo ${receipt.folio} correspondiente al periodo ${receipt.periodStart} al ${receipt.periodEnd}.\n\nGracias por tu confianza.\nEquipo de Agencia`}
                  rows={5}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
                />
              </label>

              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Enviar recibo por correo
              </button>
            </form>
          ))}

          {!data.receipts.length && (
            <p className="text-sm text-slate-500">No hay recibos en este mes para enviar por correo.</p>
          )}
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Historial de envíos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Destinatario</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Asunto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-slate-700">{log.createdAt}</td>
                  <td className="px-4 py-3 text-slate-700">{log.clientName}</td>
                  <td className="px-4 py-3 text-slate-700">{log.toEmail}</td>
                  <td className="px-4 py-3 text-slate-700">{log.subject}</td>
                  <td className="px-4 py-3 text-slate-700">{log.provider}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        log.status === "sent"
                          ? "bg-emerald-100 text-emerald-800"
                          : log.status === "failed"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {statusLabel(log.status)}
                    </span>
                    {log.errorMessage && (
                      <p className="mt-1 max-w-xs text-xs text-rose-700">{log.errorMessage}</p>
                    )}
                  </td>
                </tr>
              ))}
              {!data.logs.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay envíos registrados todavía.
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
