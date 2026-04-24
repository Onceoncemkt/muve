import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";

interface ReceiptPdfData {
  folio: string;
  concept: string;
  amount: number;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  clientName: string;
  legalName: string | null;
  contactName: string | null;
  email: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export async function generateReceiptPdfBuffer(data: ReceiptPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const logoPath = path.join(process.cwd(), "public", "brand", "logo-once-once.svg");
  if (fs.existsSync(logoPath)) {
    const svg = fs.readFileSync(logoPath, "utf8");
    SVGtoPDF(doc, svg, 50, 38, { width: 150, height: 40 });
    doc.moveDown(2.4);
  } else {
    doc.moveDown(0.4);
  }

  doc.fillColor("#000326").fontSize(20).text("Recibo digital", { align: "left" }).moveDown(0.3);
  doc.fillColor("#1E64F2").fontSize(11).text("Once Once");
  doc.moveDown(1.5);

  doc.lineWidth(1).strokeColor("#f07df2").moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  doc.moveDown(1);
  doc.fillColor("#000326").fontSize(12).text(`Folio: ${data.folio}`);
  doc.text(`Fecha de emisión: ${data.issueDate}`);
  doc.text(`Periodo: ${data.periodStart} a ${data.periodEnd}`);
  doc.moveDown(1);

  doc.fillColor("#000326").fontSize(13).text("Cliente", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#000326").text(`Nombre comercial: ${data.clientName}`);
  doc.text(`Razón social: ${data.legalName ?? "N/D"}`);
  doc.text(`Contacto: ${data.contactName ?? "N/D"}`);
  doc.text(`Correo: ${data.email ?? "N/D"}`);
  doc.moveDown(1);

  doc.fillColor("#000326").fontSize(13).text("Detalle", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#000326").text(`Concepto: ${data.concept}`);
  doc.fontSize(16).fillColor("#1E64F2").text(`Total: ${formatCurrency(data.amount)}`);
  doc.moveDown(2);

  doc
    .fontSize(10)
    .fillColor("#000326")
    .text("Este recibo fue generado automáticamente por el sistema interno de Once Once.");

  doc.end();
  return done;
}
