import { endOfMonth, formatISO, parse, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { mockPendingPaymentsWithoutReceipt, mockReceipts } from "@/modules/mock/local-data";
import type { PaymentStatus, PaymentWithoutReceipt, ReceiptListItem } from "@/types/domain";

interface ReceiptRow {
  id: string;
  folio: string;
  concept: string;
  amount: number;
  period_start: string;
  period_end: string;
  issue_date: string;
  payment_id: string | null;
  clients: { business_name: string | null; email: string | null } | Array<{ business_name: string | null; email: string | null }> | null;
  payments: { status: PaymentStatus | null } | Array<{ status: PaymentStatus | null }> | null;
}

interface PaymentRow {
  id: string;
  due_date: string;
  amount: number;
  status: PaymentStatus;
  period_start: string;
  period_end: string;
  clients: { business_name: string | null; email: string | null } | Array<{ business_name: string | null; email: string | null }> | null;
}

function monthBounds(month: string) {
  const parsed = parse(month, "yyyy-MM", new Date());
  return {
    start: formatISO(startOfMonth(parsed), { representation: "date" }),
    end: formatISO(endOfMonth(parsed), { representation: "date" }),
  };
}

export async function getReceiptsPageData(month: string) {
  if (isLocalMockMode) {
    return {
      receipts: mockReceipts,
      pendingPayments: mockPendingPaymentsWithoutReceipt,
    };
  }
  const supabase = createClient();
  const { start, end } = monthBounds(month);

  const [receiptsRes, paymentsRes] = await Promise.all([
    supabase
      .from("invoices_or_receipts")
      .select(
        `
          id,
          folio,
          concept,
          amount,
          period_start,
          period_end,
          issue_date,
          payment_id,
          clients (
            business_name,
            email
          ),
          payments (
            status
          )
        `,
      )
      .gte("period_start", start)
      .lte("period_start", end)
      .order("issue_date", { ascending: false }),
    supabase
      .from("payments")
      .select(
        `
          id,
          due_date,
          amount,
          status,
          period_start,
          period_end,
          clients (
            business_name,
            email
          )
        `,
      )
      .gte("period_start", start)
      .lte("period_start", end)
      .order("due_date", { ascending: true }),
  ]);

  const receiptRows = ((receiptsRes.data ?? []) as ReceiptRow[]) ?? [];
  const paymentRows = ((paymentsRes.data ?? []) as PaymentRow[]) ?? [];

  const receipts: ReceiptListItem[] = receiptRows.map((row) => {
    const clientData = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const paymentData = Array.isArray(row.payments) ? row.payments[0] : row.payments;
    return {
      id: row.id,
      folio: row.folio,
      clientName: clientData?.business_name ?? "Cliente",
      clientEmail: clientData?.email ?? null,
      concept: row.concept,
      amount: Number(row.amount ?? 0),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      issueDate: row.issue_date,
      paymentStatus: paymentData?.status ?? null,
    };
  });

  const paymentIdsWithReceipt = new Set(
    receiptRows.map((row) => row.payment_id).filter((value): value is string => Boolean(value)),
  );

  const pendingPayments: PaymentWithoutReceipt[] = paymentRows
    .filter((row) => !paymentIdsWithReceipt.has(row.id))
    .map((row) => {
      const clientData = Array.isArray(row.clients) ? row.clients[0] : row.clients;
      return {
        paymentId: row.id,
        clientName: clientData?.business_name ?? "Cliente",
        clientEmail: clientData?.email ?? null,
        dueDate: row.due_date,
        amount: Number(row.amount ?? 0),
        status: row.status,
        periodStart: row.period_start,
        periodEnd: row.period_end,
      };
    });

  return { receipts, pendingPayments };
}

export async function getReceiptById(receiptId: string) {
  if (isLocalMockMode) {
    const receipt = mockReceipts.find((row) => row.id === receiptId);
    if (!receipt) return null;
    return {
      id: receipt.id,
      client_id: "mock-client-id",
      payment_id: null,
      folio: receipt.folio,
      concept: receipt.concept,
      amount: receipt.amount,
      period_start: receipt.periodStart,
      period_end: receipt.periodEnd,
      issue_date: receipt.issueDate,
      clients: {
        business_name: receipt.clientName,
        legal_name: null,
        contact_name: null,
        email: receipt.clientEmail,
      },
    };
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("invoices_or_receipts")
    .select(
      `
        id,
        client_id,
        payment_id,
        folio,
        concept,
        amount,
        period_start,
        period_end,
        issue_date,
        clients (
          business_name,
          legal_name,
          contact_name,
          email
        )
      `,
    )
    .eq("id", receiptId)
    .maybeSingle();

  return data as
    | {
        id: string;
        client_id: string;
        payment_id: string | null;
        folio: string;
        concept: string;
        amount: number;
        period_start: string;
        period_end: string;
        issue_date: string;
        clients:
          | {
              business_name: string | null;
              legal_name: string | null;
              contact_name: string | null;
              email: string | null;
            }
          | Array<{
              business_name: string | null;
              legal_name: string | null;
              contact_name: string | null;
              email: string | null;
            }>
          | null;
      }
    | null;
}
