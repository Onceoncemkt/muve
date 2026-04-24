"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { resolveEmailProvider, sendReceiptEmail } from "@/modules/emails/provider";
import { generateReceiptPdfBuffer } from "@/modules/receipts/pdf";
import { getReceiptById } from "@/modules/receipts/queries";

export async function sendReceiptEmailAction(receiptId: string, formData: FormData) {
  if (isLocalMockMode) {
    const month = String(formData.get("month") ?? "");
    if (month) {
      redirect(`/emails?month=${month}`);
    }
    redirect("/emails");
  }
  const provider = resolveEmailProvider();
  const month = String(formData.get("month") ?? "");
  const to = String(formData.get("toEmail") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!to || !subject || !body) {
    throw new Error("Completa destinatario, asunto y mensaje");
  }

  const receipt = await getReceiptById(receiptId);
  if (!receipt) {
    throw new Error("Recibo no encontrado");
  }

  const client = Array.isArray(receipt.clients) ? receipt.clients[0] : receipt.clients;

  const pdfBuffer = await generateReceiptPdfBuffer({
    folio: receipt.folio,
    concept: receipt.concept,
    amount: Number(receipt.amount ?? 0),
    issueDate: receipt.issue_date,
    periodStart: receipt.period_start,
    periodEnd: receipt.period_end,
    clientName: client?.business_name ?? "Cliente",
    legalName: client?.legal_name ?? null,
    contactName: client?.contact_name ?? null,
    email: client?.email ?? null,
  });

  const supabase = createClient();

  try {
    const sent = await sendReceiptEmail({
      to,
      subject,
      body,
      brandLogoUrl: `${process.env.NEXT_PUBLIC_APP_URL}/brand/logo-once-once-dark.svg`,
      brandName: "Once Once",
      pdfFilename: `${receipt.folio}.pdf`,
      pdfBuffer,
    });

    await supabase.from("email_logs").insert({
      client_id: receipt.client_id,
      payment_id: receipt.payment_id,
      receipt_id: receipt.id,
      provider: sent.provider,
      to_email: to,
      subject,
      body,
      status: "sent",
      provider_message_id: sent.messageId,
      sent_at: new Date().toISOString(),
    } as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await supabase.from("email_logs").insert({
      client_id: receipt.client_id,
      payment_id: receipt.payment_id,
      receipt_id: receipt.id,
      provider,
      to_email: to,
      subject,
      body,
      status: "failed",
      error_message: message,
    } as never);
    throw error;
  }

  revalidatePath("/emails");
  if (month) {
    redirect(`/emails?month=${month}`);
  }
  redirect("/emails");
}
