import { NextResponse } from "next/server";
import { generateReceiptPdfBuffer } from "@/modules/receipts/pdf";
import { getReceiptById } from "@/modules/receipts/queries";

export const runtime = "nodejs";

interface ReceiptPdfRouteProps {
  params: { id: string };
}

export async function GET(_request: Request, { params }: ReceiptPdfRouteProps) {
  const receipt = await getReceiptById(params.id);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const client = Array.isArray(receipt.clients) ? receipt.clients[0] : receipt.clients;
  const buffer = await generateReceiptPdfBuffer({
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"${receipt.folio}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}
