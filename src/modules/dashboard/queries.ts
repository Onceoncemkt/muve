import { addDays, endOfMonth, formatISO, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { mockKpisData } from "@/modules/mock/local-data";
import type { KpiSummary } from "@/types/domain";

const emptyKpis: KpiSummary = {
  totalExpectedMonth: 0,
  totalCollectedMonth: 0,
  pendingPayments: 0,
  overduePayments: 0,
  upcomingPayments: 0,
};

function sumAmounts(rows: { amount: number }[] | null) {
  if (!rows?.length) return 0;
  return rows.reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
}

export async function getDashboardKpis(referenceDate = new Date()): Promise<KpiSummary> {
  if (isLocalMockMode) {
    return mockKpisData;
  }
  const supabase = createClient();
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const today = new Date();
  const nextWeek = addDays(today, 7);

  const [expectedRes, collectedRes, pendingRes, overdueRes, upcomingRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .gte("period_start", formatISO(monthStart, { representation: "date" }))
      .lte("period_start", formatISO(monthEnd, { representation: "date" })),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "paid")
      .gte("period_start", formatISO(monthStart, { representation: "date" }))
      .lte("period_start", formatISO(monthEnd, { representation: "date" })),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("due_date", formatISO(today, { representation: "date" }))
      .lte("due_date", formatISO(nextWeek, { representation: "date" })),
  ]);

  if (
    expectedRes.error ||
    collectedRes.error ||
    pendingRes.error ||
    overdueRes.error ||
    upcomingRes.error
  ) {
    return emptyKpis;
  }

  return {
    totalExpectedMonth: sumAmounts(expectedRes.data),
    totalCollectedMonth: sumAmounts(collectedRes.data),
    pendingPayments: pendingRes.count ?? 0,
    overduePayments: overdueRes.count ?? 0,
    upcomingPayments: upcomingRes.count ?? 0,
  };
}
