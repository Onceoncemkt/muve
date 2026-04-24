"use client";

import { useMemo, useState } from "react";
import type { RecordStatus } from "@/types/domain";

interface PlanOption {
  id: string;
  name: string;
  monthly_amount?: number | null;
}

interface ClientFormValues {
  businessName: string;
  legalName: string;
  contactName: string;
  email: string;
  phone: string;
  planId: string;
  customServiceName: string;
  monthlyAmount: string;
  paymentDay: string;
  status: RecordStatus;
  notes: string;
}

interface ClientFormProps {
  action: (formData: FormData) => void | Promise<void>;
  plans: PlanOption[];
  submitLabel: string;
  initialValues?: Partial<ClientFormValues>;
}

const defaultValues: ClientFormValues = {
  businessName: "",
  legalName: "",
  contactName: "",
  email: "",
  phone: "",
  planId: "",
  customServiceName: "",
  monthlyAmount: "",
  paymentDay: "1",
  status: "active",
  notes: "",
};

export function ClientForm({ action, plans, submitLabel, initialValues }: ClientFormProps) {
  const values = { ...defaultValues, ...initialValues };
  const moneyFormatter = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
  const [selectedPlanId, setSelectedPlanId] = useState(values.planId);
  const [monthlyAmount, setMonthlyAmount] = useState(values.monthlyAmount);
  const [customServiceName, setCustomServiceName] = useState(values.customServiceName);
  const [isManualAmount, setIsManualAmount] = useState(!values.planId);
  const plansById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  function onPlanChange(planId: string) {
    setSelectedPlanId(planId);
    if (!planId) {
      setIsManualAmount(true);
      return;
    }

    const selectedPlan = plansById.get(planId);
    if (!selectedPlan) return;

    if (selectedPlan.monthly_amount != null) {
      setMonthlyAmount(String(selectedPlan.monthly_amount));
    }
    setCustomServiceName(selectedPlan.name);
    setIsManualAmount(false);
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-slate-600">Nombre comercial *</span>
          <input
            required
            name="businessName"
            defaultValue={values.businessName}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Razón social</span>
          <input
            name="legalName"
            defaultValue={values.legalName}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Contacto</span>
          <input
            name="contactName"
            defaultValue={values.contactName}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Correo</span>
          <input
            type="email"
            name="email"
            defaultValue={values.email}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Teléfono</span>
          <input
            name="phone"
            defaultValue={values.phone}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Plan</span>
          <select
            name="planId"
            value={selectedPlanId}
            onChange={(event) => onPlanChange(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          >
            <option value="">Sin plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.monthly_amount != null
                  ? `${plan.name} - ${moneyFormatter.format(plan.monthly_amount)}`
                  : plan.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Servicio personalizado</span>
          <input
            name="customServiceName"
            value={customServiceName}
            onChange={(event) => setCustomServiceName(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <div className="space-y-1">
          <label className="text-sm text-slate-600" htmlFor="monthlyAmount">
            Monto mensual (MXN) *
          </label>
          <input
            id="monthlyAmount"
            required
            min="1"
            step="0.01"
            type="number"
            name="monthlyAmount"
            value={monthlyAmount}
            onChange={(event) => setMonthlyAmount(event.target.value)}
            readOnly={Boolean(selectedPlanId) && !isManualAmount}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring read-only:bg-slate-100 read-only:text-slate-500"
          />
          <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={isManualAmount}
              disabled={!selectedPlanId}
              onChange={(event) => setIsManualAmount(event.target.checked)}
            />
            Editar monto manualmente
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Día de pago *</span>
          <input
            required
            min="1"
            max="31"
            type="number"
            name="paymentDay"
            defaultValue={values.paymentDay}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-slate-600">Estatus *</span>
          <select
            name="status"
            defaultValue={values.status}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-slate-600">Notas internas</span>
        <textarea
          name="notes"
          defaultValue={values.notes}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
