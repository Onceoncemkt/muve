"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
interface PaymentForReceipt {
  id: string;
  client_id: string;
  amount: number;
  period_start: string;
  period_end: string;
}

export async function generateReceiptForPaymentAction(paymentId: string, formData: FormData) {
  const month = String(formData.get("month") ?? "");
  if (isLocalMockMode) {
    if (month) {
      redirect(`/receipts?month=${month}`);
    }
    redirect("/receipts");
  }
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("invoices_or_receipts")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (!existing) {
    const { data: paymentRaw } = await supabase
      .from("payments")
      .select("id,client_id,amount,period_start,period_end")
      .eq("id", paymentId)
      .maybeSingle();
    const payment = (paymentRaw ?? null) as PaymentForReceipt | null;

    if (!payment) {
      throw new Error("Pago no encontrado");
    }

    const { error } = await supabase.from("invoices_or_receipts").insert({
      client_id: payment.client_id,
      payment_id: payment.id,
      folio: "",
      concept: "Servicio mensual de marketing digital",
      amount: payment.amount,
      period_start: payment.period_start,
      period_end: payment.period_end,
      issue_date: new Date().toISOString().slice(0, 10),
      branding_snapshot: {
        agency_name: "Tu Agencia",
        primary_color: "#0f172a",
        secondary_color: "#334155",
      },
    } as never);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/receipts");
  if (month) {
    redirect(`/receipts?month=${month}`);
  }
  redirect("/receipts");
}
