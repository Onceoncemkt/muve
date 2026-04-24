import { endOfMonth, formatISO, parse, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { mockPayments } from "@/modules/mock/local-data";
import type { PaymentListItem, PaymentStatus } from "@/types/domain";

export interface PaymentFilters {
  q?: string;
  status?: PaymentStatus | "all";
  month?: string;
}
interface PaymentQueryRow {
  id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  payment_method: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  clients: { business_name: string | null; email: string | null } | Array<{ business_name: string | null; email: string | null }> | null;
}

const DEFAULT_LIMIT = 300;

function parseMonthBounds(month?: string) {
  const parsed = month ? parse(month, "yyyy-MM", new Date()) : new Date();
  const monthStart = startOfMonth(parsed);
  const monthEnd = endOfMonth(parsed);
  return {
    monthStart: formatISO(monthStart, { representation: "date" }),
    monthEnd: formatISO(monthEnd, { representation: "date" }),
  };
}

export async function getPaymentsList(filters: PaymentFilters): Promise<PaymentListItem[]> {
  if (isLocalMockMode) {
    const statusFiltered =
      filters.status && filters.status !== "all"
        ? mockPayments.filter((row) => row.status === filters.status)
        : mockPayments;

    const search = filters.q?.trim().toLowerCase();
    if (!search) return statusFiltered;

    return statusFiltered.filter(
      (row) =>
        row.clientName.toLowerCase().includes(search) ||
        row.clientEmail?.toLowerCase().includes(search),
    );
  }
  const { monthStart, monthEnd } = parseMonthBounds(filters.month);
  const supabase = createClient();

  let query = supabase
    .from("payments")
    .select(
      `
        id,
        period_start,
        period_end,
        due_date,
        amount,
        payment_method,
        status,
        paid_at,
        clients (
          business_name,
          email
        )
      `,
    )
    .gte("period_start", monthStart)
    .lte("period_start", monthEnd)
    .order("due_date", { ascending: true })
    .limit(DEFAULT_LIMIT);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const search = filters.q?.trim().toLowerCase();

  const rows = (data ?? []) as PaymentQueryRow[];

  const mapped = rows.map((row) => {
    const clientData = Array.isArray(row.clients) ? row.clients[0] : row.clients;

    return {
      id: row.id,
      clientName: clientData?.business_name ?? "Cliente sin nombre",
      clientEmail: clientData?.email ?? null,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      dueDate: row.due_date,
      amount: Number(row.amount ?? 0),
      paymentMethod: row.payment_method,
      status: row.status,
      paidAt: row.paid_at,
    } satisfies PaymentListItem;
  });

  if (!search) return mapped;

  return mapped.filter(
    (row) =>
      row.clientName.toLowerCase().includes(search) ||
      row.clientEmail?.toLowerCase().includes(search),
  );
}
