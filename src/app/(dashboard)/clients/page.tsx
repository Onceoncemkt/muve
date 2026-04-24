import Link from "next/link";
import type { RecordStatus } from "@/types/domain";
import { getClients } from "@/modules/clients/queries";

interface ClientsPageProps {
  searchParams?: {
    q?: string;
    status?: RecordStatus | "all";
  };
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const q = searchParams?.q ?? "";
  const status = searchParams?.status ?? "all";
  const clients = await getClients({ q, status });

  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Clientes</h2>
          <p className="text-sm text-slate-600">Gestión de cuentas activas/inactivas y facturación mensual.</p>
        </div>
        <Link
          href="/clients/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nuevo cliente
        </Link>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente, contacto o correo"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        >
          <option value="all">Todos los estatus</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Aplicar filtros
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Contacto</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Servicio</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Día de pago</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Estatus</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{client.businessName}</p>
                  <p className="text-xs text-slate-500">{client.legalName ?? "Sin razón social"}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{client.contactName ?? "Sin contacto"}</p>
                  <p className="text-xs text-slate-500">{client.email ?? "Sin correo"}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{client.planName ?? "Personalizado"}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {currency.format(client.monthlyAmount)}
                </td>
                <td className="px-4 py-3 text-slate-700">{client.paymentDay}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      client.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {client.status === "active" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/clients/${client.id}`} className="text-slate-700 hover:underline">
                      Ver
                    </Link>
                    <Link
                      href={`/clients/${client.id}/edit`}
                      className="text-slate-700 hover:underline"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!clients.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay clientes con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
