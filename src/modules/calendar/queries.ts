import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { mockCalendarEvents } from "@/modules/mock/local-data";
import type { PaymentCalendarEvent, PaymentStatus } from "@/types/domain";

interface CalendarRange {
  start: string;
  end: string;
}

interface CalendarQueryRow {
  id: string;
  due_date: string;
  amount: number;
  status: PaymentStatus;
  clients: { business_name: string | null; email: string | null } | Array<{ business_name: string | null; email: string | null }> | null;
}

export async function getPaymentCalendarEvents(range: CalendarRange): Promise<PaymentCalendarEvent[]> {
  if (isLocalMockMode) {
    return mockCalendarEvents.filter((event) => event.start >= range.start && event.start <= range.end);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
        id,
        due_date,
        amount,
        status,
        clients (
          business_name,
          email
        )
      `,
    )
    .gte("due_date", range.start)
    .lte("due_date", range.end)
    .order("due_date", { ascending: true });

  if (error || !data) return [];

  const rows = (data ?? []) as CalendarQueryRow[];
  return rows.map((row) => {
    const clientData = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const clientName = clientData?.business_name ?? "Cliente";
    return {
      id: row.id,
      title: `${clientName} · $${Number(row.amount).toLocaleString("es-MX")}`,
      start: row.due_date,
      end: row.due_date,
      status: row.status,
      amount: Number(row.amount),
      clientName,
      clientEmail: clientData?.email ?? null,
    };
  });
}
