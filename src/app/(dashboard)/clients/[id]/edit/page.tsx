import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { updateClientAction } from "@/modules/clients/actions";
import { getActivePlans, getClientByIdForEdit } from "@/modules/clients/queries";

interface EditClientPageProps {
  params: { id: string };
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const [client, plans] = await Promise.all([getClientByIdForEdit(params.id), getActivePlans()]);
  if (!client) notFound();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Editar cliente</h2>
        <p className="text-sm text-slate-600">Actualiza información de contacto, cobro y estatus.</p>
      </div>
      <ClientForm
        action={updateClientAction.bind(null, params.id)}
        plans={plans}
        submitLabel="Guardar cambios"
        initialValues={{
          businessName: client.business_name ?? "",
          legalName: client.legal_name ?? "",
          contactName: client.contact_name ?? "",
          email: client.email ?? "",
          phone: client.phone ?? "",
          planId: client.plan_id ?? "",
          customServiceName: client.custom_service_name ?? "",
          monthlyAmount: String(client.monthly_amount ?? ""),
          paymentDay: String(client.payment_day ?? 1),
          status: client.status,
          notes: client.notes ?? "",
        }}
      />
    </section>
  );
}
