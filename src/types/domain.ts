export type RecordStatus = "active" | "inactive";
export type PaymentStatus = "pending" | "paid" | "overdue";
export type UserRole = "admin";

export interface KpiSummary {
  totalExpectedMonth: number;
  totalCollectedMonth: number;
  pendingPayments: number;
  overduePayments: number;
  upcomingPayments: number;
}

export interface PaymentListItem {
  id: string;
  clientName: string;
  clientEmail: string | null;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number;
  paymentMethod: string | null;
  status: PaymentStatus;
  paidAt: string | null;
}

export interface PaymentCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  status: PaymentStatus;
  amount: number;
  clientName: string;
  clientEmail: string | null;
}

export interface ClientListItem {
  id: string;
  businessName: string;
  legalName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  planName: string | null;
  monthlyAmount: number;
  paymentDay: number;
  status: RecordStatus;
}

export interface ClientDetail extends ClientListItem {
  notes: string | null;
  recentPayments: Array<{
    id: string;
    dueDate: string;
    amount: number;
    status: PaymentStatus;
    paidAt: string | null;
  }>;
}

export interface ReceiptListItem {
  id: string;
  folio: string;
  clientName: string;
  clientEmail: string | null;
  concept: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  paymentStatus: PaymentStatus | null;
}

export interface PaymentWithoutReceipt {
  paymentId: string;
  clientName: string;
  clientEmail: string | null;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  periodStart: string;
  periodEnd: string;
}

export interface EmailableReceipt {
  receiptId: string;
  folio: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  concept: string;
  amount: number;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
}

export interface EmailLogItem {
  id: string;
  createdAt: string;
  clientName: string;
  toEmail: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  provider: "resend" | "smtp";
  errorMessage: string | null;
}
