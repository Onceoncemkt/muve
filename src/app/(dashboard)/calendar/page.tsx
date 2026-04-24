import { PaymentsCalendar } from "@/components/calendar/payments-calendar";
export default function CalendarPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Calendario de pagos</h2>
        <p className="text-sm text-slate-600">
          Vista mensual de cobros. Haz click en un evento para ver detalle del pago.
        </p>
      </div>
      <PaymentsCalendar />
    </section>
  );
}
