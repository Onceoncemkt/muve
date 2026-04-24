"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventSourceFuncArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import type { PaymentCalendarEvent, PaymentStatus } from "@/types/domain";

const eventColors: Record<PaymentStatus, string> = {
  pending: "#d97706",
  paid: "#059669",
  overdue: "#dc2626",
};

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
};

function asCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function PaymentsCalendar() {
  const [selected, setSelected] = useState<PaymentCalendarEvent | null>(null);

  async function loadEvents(arg: EventSourceFuncArg) {
    const params = new URLSearchParams({
      start: arg.startStr.slice(0, 10),
      end: arg.endStr.slice(0, 10),
    });

    const response = await fetch(`/api/calendar-events?${params.toString()}`);
    if (!response.ok) return [];

    const items = (await response.json()) as PaymentCalendarEvent[];
    return items.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      backgroundColor: eventColors[event.status],
      borderColor: eventColors[event.status],
      textColor: "#ffffff",
      extendedProps: event,
    }));
  }

  function onEventClick(arg: EventClickArg) {
    const details = arg.event.extendedProps as PaymentCalendarEvent;
    setSelected(details);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          height={760}
          firstDay={1}
          events={loadEvents}
          eventClick={onEventClick}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth",
          }}
          buttonText={{
            today: "Hoy",
            month: "Mes",
          }}
        />
      </div>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Detalle de evento</h3>

        {!selected && (
          <p className="mt-3 text-sm text-slate-500">
            Selecciona un pago en el calendario para ver su información.
          </p>
        )}

        {selected && (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-slate-500">Cliente</p>
              <p className="font-medium text-slate-900">{selected.clientName}</p>
            </div>
            <div>
              <p className="text-slate-500">Correo</p>
              <p className="font-medium text-slate-900">{selected.clientEmail ?? "Sin correo"}</p>
            </div>
            <div>
              <p className="text-slate-500">Monto</p>
              <p className="font-medium text-slate-900">{asCurrency(selected.amount)}</p>
            </div>
            <div>
              <p className="text-slate-500">Fecha de vencimiento</p>
              <p className="font-medium text-slate-900">{selected.start}</p>
            </div>
            <div>
              <p className="text-slate-500">Estatus</p>
              <span
                className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: eventColors[selected.status] }}
              >
                {statusLabels[selected.status]}
              </span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
