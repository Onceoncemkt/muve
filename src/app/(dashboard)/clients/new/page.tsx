import { ClientForm } from "@/components/clients/client-form";
import { createClientAction } from "@/modules/clients/actions";
import { getActivePlans } from "@/modules/clients/queries";

export default async function NewClientPage() {
  const plans = await getActivePlans();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Nuevo cliente</h2>
        <p className="text-sm text-slate-600">Completa los datos comerciales y de cobro mensual.</p>
      </div>
      <ClientForm action={createClientAction} plans={plans} submitLabel="Guardar cliente" />
    </section>
  );
}
