import type {
  ClientDetail,
  ClientListItem,
  EmailLogItem,
  EmailableReceipt,
  KpiSummary,
  PaymentWithoutReceipt,
  ReceiptListItem,
  PaymentCalendarEvent,
  PaymentListItem,
} from "@/types/domain";

export const mockKpisData: KpiSummary = {
  totalExpectedMonth: 128500,
  totalCollectedMonth: 84200,
  pendingPayments: 6,
  overduePayments: 2,
  upcomingPayments: 4,
};

export const mockClients: ClientListItem[] = [
  {
    id: "mock-client-1",
    businessName: "Nativa Estudio",
    legalName: "Nativa Estudio Creativo S.A. de C.V.",
    contactName: "Laura Pérez",
    email: "laura@nativaestudio.mx",
    phone: "+52 55 1111 2222",
    planName: "Plan Full Marketing",
    monthlyAmount: 22000,
    paymentDay: 5,
    status: "active",
  },
  {
    id: "mock-client-2",
    businessName: "Comercial Delta",
    legalName: "Comercial Delta S. de R.L. de C.V.",
    contactName: "Mario Gómez",
    email: "mario@comercialdelta.com",
    phone: "+52 81 3333 4444",
    planName: "Plan Ads Growth",
    monthlyAmount: 12500,
    paymentDay: 12,
    status: "active",
  },
  {
    id: "mock-client-3",
    businessName: "Studio Verde",
    legalName: "Studio Verde Digital S.A.P.I. de C.V.",
    contactName: "Ana Ruiz",
    email: "ana@studioverde.mx",
    phone: "+52 33 5555 6666",
    planName: "Plan SEO Básico",
    monthlyAmount: 8500,
    paymentDay: 18,
    status: "inactive",
  },
];

export const mockReceipts: ReceiptListItem[] = [
  {
    id: "mock-receipt-1",
    folio: "REC-202604-000001",
    clientName: "Nativa Estudio",
    clientEmail: "laura@nativaestudio.mx",
    concept: "Servicio mensual de marketing digital",
    amount: 22000,
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    issueDate: "2026-04-04",
    paymentStatus: "paid",
  },
  {
    id: "mock-receipt-2",
    folio: "REC-202604-000002",
    clientName: "Comercial Delta",
    clientEmail: "mario@comercialdelta.com",
    concept: "Servicio mensual de marketing digital",
    amount: 12500,
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    issueDate: "2026-04-10",
    paymentStatus: "pending",
  },
];

export const mockPendingPaymentsWithoutReceipt: PaymentWithoutReceipt[] = [
  {
    paymentId: "mock-payment-3",
    clientName: "Studio Verde",
    clientEmail: "ana@studioverde.mx",
    dueDate: "2026-04-18",
    amount: 8500,
    status: "overdue",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
  },
];

export const mockEmailableReceipts: EmailableReceipt[] = mockReceipts.map((receipt) => ({
  receiptId: receipt.id,
  folio: receipt.folio,
  clientId: `mock-${receipt.id}`,
  clientName: receipt.clientName,
  clientEmail: receipt.clientEmail,
  concept: receipt.concept,
  amount: receipt.amount,
  issueDate: receipt.issueDate,
  periodStart: receipt.periodStart,
  periodEnd: receipt.periodEnd,
}));

export const mockEmailLogs: EmailLogItem[] = [
  {
    id: "mock-email-1",
    createdAt: "2026-04-05T12:15:00.000Z",
    clientName: "Nativa Estudio",
    toEmail: "laura@nativaestudio.mx",
    subject: "Recibo de pago correspondiente a abril 2026",
    status: "sent",
    provider: "resend",
    errorMessage: null,
  },
];

export const mockPayments: PaymentListItem[] = [
  {
    id: "mock-payment-1",
    clientName: "Nativa Estudio",
    clientEmail: "laura@nativaestudio.mx",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    dueDate: "2026-04-05",
    amount: 22000,
    paymentMethod: "Transferencia",
    status: "paid",
    paidAt: "2026-04-04T18:30:00.000Z",
  },
  {
    id: "mock-payment-2",
    clientName: "Comercial Delta",
    clientEmail: "mario@comercialdelta.com",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    dueDate: "2026-04-12",
    amount: 12500,
    paymentMethod: null,
    status: "pending",
    paidAt: null,
  },
  {
    id: "mock-payment-3",
    clientName: "Studio Verde",
    clientEmail: "ana@studioverde.mx",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    dueDate: "2026-04-18",
    amount: 8500,
    paymentMethod: null,
    status: "overdue",
    paidAt: null,
  },
];

export const mockCalendarEvents: PaymentCalendarEvent[] = mockPayments.map((payment) => ({
  id: payment.id,
  title: `${payment.clientName} · $${payment.amount.toLocaleString("es-MX")}`,
  start: payment.dueDate,
  end: payment.dueDate,
  status: payment.status,
  amount: payment.amount,
  clientName: payment.clientName,
  clientEmail: payment.clientEmail,
}));

export function mockClientDetailById(clientId: string): ClientDetail | null {
  const base = mockClients.find((client) => client.id === clientId);
  if (!base) return null;

  const relatedPayments = mockPayments
    .filter((payment) => payment.clientName === base.businessName)
    .slice(0, 6)
    .map((payment) => ({
      id: payment.id,
      dueDate: payment.dueDate,
      amount: payment.amount,
      status: payment.status,
      paidAt: payment.paidAt,
    }));

  return {
    ...base,
    notes: "Datos mock para desarrollo local sin Supabase.",
    recentPayments: relatedPayments,
  };
}
