"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { clientFormSchema } from "@/modules/clients/schema";

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePlanId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(trimmed) ? trimmed : null;
}

function formatSupabaseError(error: PostgrestError, context: string) {
  const pieces = [`${context}: ${error.message}`];
  if (error.code) pieces.push(`code=${error.code}`);
  if (error.details) pieces.push(`details=${error.details}`);
  if (error.hint) pieces.push(`hint=${error.hint}`);
  return pieces.join(" | ");
}

export async function createClientAction(formData: FormData) {
  if (isLocalMockMode) {
    redirect("/clients");
  }
  const parsed = clientFormSchema.safeParse({
    businessName: formData.get("businessName"),
    legalName: formData.get("legalName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    planId: formData.get("planId"),
    customServiceName: formData.get("customServiceName"),
    monthlyAmount: formData.get("monthlyAmount"),
    paymentDay: formData.get("paymentDay"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const supabase = createClient();
  const payload = parsed.data;

  const { error } = await supabase.from("clients").insert({
    business_name: payload.businessName,
    legal_name: normalizeText(payload.legalName),
    contact_name: normalizeText(payload.contactName),
    email: normalizeText(payload.email),
    phone: normalizeText(payload.phone),
    plan_id: normalizePlanId(payload.planId),
    custom_service_name: normalizeText(payload.customServiceName),
    monthly_amount: payload.monthlyAmount,
    payment_day: payload.paymentDay,
    status: payload.status,
    notes: normalizeText(payload.notes),
  } as never);

  if (error) {
    const message = formatSupabaseError(error, "Error al crear cliente");
    console.error(message, error);
    throw new Error(message);
  }

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClientAction(clientId: string, formData: FormData) {
  if (isLocalMockMode) {
    redirect(`/clients/${clientId}`);
  }
  const parsed = clientFormSchema.safeParse({
    businessName: formData.get("businessName"),
    legalName: formData.get("legalName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    planId: formData.get("planId"),
    customServiceName: formData.get("customServiceName"),
    monthlyAmount: formData.get("monthlyAmount"),
    paymentDay: formData.get("paymentDay"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const supabase = createClient();
  const payload = parsed.data;

  const { error } = await supabase
    .from("clients")
    .update({
      business_name: payload.businessName,
      legal_name: normalizeText(payload.legalName),
      contact_name: normalizeText(payload.contactName),
      email: normalizeText(payload.email),
      phone: normalizeText(payload.phone),
      plan_id: normalizePlanId(payload.planId),
      custom_service_name: normalizeText(payload.customServiceName),
      monthly_amount: payload.monthlyAmount,
      payment_day: payload.paymentDay,
      status: payload.status,
      notes: normalizeText(payload.notes),
    } as never)
    .eq("id", clientId);

  if (error) {
    const message = formatSupabaseError(error, "Error al actualizar cliente");
    console.error(message, error);
    throw new Error(message);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
