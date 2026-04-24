import { createClient } from "@/lib/supabase/server";
import { isLocalMockMode } from "@/lib/supabase/runtime";
import { mockClientDetailById, mockClients } from "@/modules/mock/local-data";
import type { ClientDetail, ClientListItem, RecordStatus } from "@/types/domain";

interface ClientFilters {
  q?: string;
  status?: RecordStatus | "all";
}

interface ClientRow {
  id: string;
  business_name: string;
  legal_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  monthly_amount: number;
  payment_day: number;
  status: RecordStatus;
  notes: string | null;
  plans: { name: string | null } | Array<{ name: string | null }> | null;
}

interface PaymentMiniRow {
  id: string;
  due_date: string;
  amount: number;
  status: "pending" | "paid" | "overdue";
  paid_at: string | null;
}

interface PlanOptionRow {
  id: string;
  name: string;
  monthly_amount: number | null;
}

const DEFAULT_PLAN_CATALOG = [
  { id: "catalog-basico", name: "BÁSICO", monthly_amount: 6000 },
  { id: "catalog-basico-2026", name: "BÁSICO 2026", monthly_amount: 9000 },
  { id: "catalog-full", name: "FULL", monthly_amount: 12000 },
  { id: "catalog-shooting", name: "SHOOTING", monthly_amount: 5000 },
  { id: "catalog-video-institucional", name: "VIDEO INSTITUCIONAL", monthly_amount: 30000 },
  { id: "catalog-master", name: "MASTER", monthly_amount: 15000 },
  { id: "catalog-basico-2025", name: "BASICO 2025", monthly_amount: 7000 },
];

export interface ClientEditRow {
  id: string;
  business_name: string;
  legal_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  plan_id: string | null;
  custom_service_name: string | null;
  monthly_amount: number;
  payment_day: number;
  status: RecordStatus;
  notes: string | null;
}

export async function getClients(filters: ClientFilters): Promise<ClientListItem[]> {
  if (isLocalMockMode) {
    const byStatus =
      filters.status && filters.status !== "all"
        ? mockClients.filter((client) => client.status === filters.status)
        : mockClients;

    const search = filters.q?.trim().toLowerCase();
    if (!search) return byStatus;

    return byStatus.filter(
      (item) =>
        item.businessName.toLowerCase().includes(search) ||
        item.contactName?.toLowerCase().includes(search) ||
        item.email?.toLowerCase().includes(search),
    );
  }
  const supabase = createClient();

  let query = supabase
    .from("clients")
    .select(
      `
        id,
        business_name,
        legal_name,
        contact_name,
        email,
        phone,
        monthly_amount,
        payment_day,
        status,
        notes,
        plans (
          name
        )
      `,
    )
    .order("business_name", { ascending: true });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = (data ?? []) as ClientRow[];
  const mapped = rows.map((row) => {
    const planData = Array.isArray(row.plans) ? row.plans[0] : row.plans;
    return {
      id: row.id,
      businessName: row.business_name,
      legalName: row.legal_name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      planName: planData?.name ?? null,
      monthlyAmount: Number(row.monthly_amount ?? 0),
      paymentDay: row.payment_day,
      status: row.status,
    } satisfies ClientListItem;
  });

  const search = filters.q?.trim().toLowerCase();
  if (!search) return mapped;

  return mapped.filter(
    (item) =>
      item.businessName.toLowerCase().includes(search) ||
      item.contactName?.toLowerCase().includes(search) ||
      item.email?.toLowerCase().includes(search),
  );
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  if (isLocalMockMode) {
    return mockClientDetailById(clientId);
  }
  const supabase = createClient();

  const { data: clientRaw, error: clientError } = await supabase
    .from("clients")
    .select(
      `
        id,
        business_name,
        legal_name,
        contact_name,
        email,
        phone,
        monthly_amount,
        payment_day,
        status,
        notes,
        plans (
          name
        )
      `,
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !clientRaw) return null;

  const client = clientRaw as ClientRow;

  const { data: paymentsRaw } = await supabase
    .from("payments")
    .select("id,due_date,amount,status,paid_at")
    .eq("client_id", clientId)
    .order("due_date", { ascending: false })
    .limit(6);

  const payments = ((paymentsRaw ?? []) as PaymentMiniRow[]).map((row) => ({
    id: row.id,
    dueDate: row.due_date,
    amount: Number(row.amount ?? 0),
    status: row.status,
    paidAt: row.paid_at,
  }));

  const planData = Array.isArray(client.plans) ? client.plans[0] : client.plans;

  return {
    id: client.id,
    businessName: client.business_name,
    legalName: client.legal_name,
    contactName: client.contact_name,
    email: client.email,
    phone: client.phone,
    planName: planData?.name ?? null,
    monthlyAmount: Number(client.monthly_amount ?? 0),
    paymentDay: client.payment_day,
    status: client.status,
    notes: client.notes,
    recentPayments: payments,
  };
}

export async function getClientByIdForEdit(clientId: string) {
  if (isLocalMockMode) {
    const client = mockClients.find((row) => row.id === clientId);
    if (!client) return null;
    return {
      id: client.id,
      business_name: client.businessName,
      legal_name: client.legalName,
      contact_name: client.contactName,
      email: client.email,
      phone: client.phone,
      plan_id: null,
      custom_service_name: null,
      monthly_amount: client.monthlyAmount,
      payment_day: client.paymentDay,
      status: client.status,
      notes: "Datos mock para desarrollo local",
    } as ClientEditRow;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id,business_name,legal_name,contact_name,email,phone,plan_id,custom_service_name,monthly_amount,payment_day,status,notes",
    )
    .eq("id", clientId)
    .maybeSingle();
  return (data ?? null) as ClientEditRow | null;
}

export async function getActivePlans() {
  if (isLocalMockMode) {
    return DEFAULT_PLAN_CATALOG;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id,name,monthly_amount")
    .eq("active", true)
    .order("name");
  const planRows = (data ?? []) as PlanOptionRow[];
  if (error || planRows.length === 0) {
    return DEFAULT_PLAN_CATALOG;
  }
  const dbByName = new Map(planRows.map((plan) => [plan.name, plan]));
  const mergedCatalog = DEFAULT_PLAN_CATALOG.map((catalogPlan) => dbByName.get(catalogPlan.name) ?? catalogPlan);
  const extraDbPlans = planRows.filter(
    (plan) => !DEFAULT_PLAN_CATALOG.some((catalogPlan) => catalogPlan.name === plan.name),
  );
  return [...mergedCatalog, ...extraDbPlans];
}
