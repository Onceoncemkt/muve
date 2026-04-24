import { endOfMonth, formatISO, parse, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { mockEmailLogs, mockEmailableReceipts } from "@/modules/mock/local-data";
import type { EmailLogItem, EmailableReceipt } from "@/types/domain";

interface ReceiptEmailRow {
  id: string;
  folio: string;
  client_id: string;
  concept: string;
  amount: number;
  issue_date: string;
  period_start: string;
  period_end: string;
  clients: { business_name: string | null; email: string | null } | Array<{ business_name: string | null; email: string | null }> | null;
}

interface EmailLogRow {
  id: string;
  created_at: string;
  to_email: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  provider: "resend" | "smtp";
  error_message: string | null;
  clients: { business_name: string | null } | Array<{ business_name: string | null }> | null;
}

function monthBounds(month: string) {
  const parsed = parse(month, "yyyy-MM", new Date());
  return {
    start: formatISO(startOfMonth(parsed), { representation: "date" }),
    end: formatISO(endOfMonth(parsed), { representation: "date" }),
  };
}

export async function getEmailCenterData(month: string) {
  if (isLocalMockMode) {
    return {
      receipts: mockEmailableReceipts,
      logs: mockEmailLogs,
    };
  }
  const supabase = createClient();
  const { start, end } = monthBounds(month);

  const [receiptsRes, logsRes] = await Promise.all([
    supabase
      .from("invoices_or_receipts")
      .select(
        `
          id,
          folio,
          client_id,
          concept,
          amount,
          issue_date,
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
      .order("issue_date", { ascending: false }),
    supabase
      .from("email_logs")
      .select(
        `
          id,
          created_at,
          to_email,
          subject,
          status,
          provider,
          error_message,
          clients (
            business_name
          )
        `,
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const receiptRows = (receiptsRes.data ?? []) as ReceiptEmailRow[];
  const logRows = (logsRes.data ?? []) as EmailLogRow[];

  const receipts: EmailableReceipt[] = receiptRows.map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      receiptId: row.id,
      folio: row.folio,
      clientId: row.client_id,
      clientName: client?.business_name ?? "Cliente",
      clientEmail: client?.email ?? null,
      concept: row.concept,
      amount: Number(row.amount ?? 0),
      issueDate: row.issue_date,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    };
  });

  const logs: EmailLogItem[] = logRows.map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      createdAt: row.created_at,
      clientName: client?.business_name ?? "Cliente",
      toEmail: row.to_email,
      subject: row.subject,
      status: row.status,
      provider: row.provider,
      errorMessage: row.error_message,
    };
  });

  return { receipts, logs };
}
