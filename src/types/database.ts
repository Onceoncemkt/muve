export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Enums: {
      email_provider: "resend" | "smtp";
      email_status: "queued" | "sent" | "failed";
      payment_status: "pending" | "paid" | "overdue";
      record_status: "active" | "inactive";
      user_role: "admin";
    };
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
        };
      };
      clients: {
        Row: {
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
          status: Database["public"]["Enums"]["record_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          monthly_amount: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          client_id: string;
          period_start: string;
          period_end: string;
          due_date: string;
          amount: number;
          payment_method: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          paid_at: string | null;
          proof_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      invoices_or_receipts: {
        Row: {
          id: string;
          client_id: string;
          payment_id: string | null;
          folio: string;
          concept: string;
          amount: number;
          period_start: string;
          period_end: string;
          issue_date: string;
          branding_snapshot: Json | null;
          pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      email_logs: {
        Row: {
          id: string;
          client_id: string;
          payment_id: string | null;
          receipt_id: string | null;
          provider: Database["public"]["Enums"]["email_provider"];
          to_email: string;
          subject: string;
          body: string;
          status: Database["public"]["Enums"]["email_status"];
          provider_message_id: string | null;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
