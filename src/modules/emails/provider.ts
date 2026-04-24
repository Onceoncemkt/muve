import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailProvider = "resend" | "smtp";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  brandLogoUrl: string;
  brandName: string;
  pdfFilename: string;
  pdfBuffer: Buffer;
}

export interface SendEmailResult {
  provider: EmailProvider;
  messageId: string | null;
}

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

export function resolveEmailProvider(): EmailProvider {
  if (env.RESEND_API_KEY) return "resend";
  if (hasSmtpConfig()) return "smtp";
  return "resend";
}

export async function sendReceiptEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM no está configurado");
  }

  const html = `
    <div style="background:#f2f2f2;padding:24px;font-family:Poppins,Arial,sans-serif;color:#000326;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,3,38,0.1);border-radius:14px;overflow:hidden;">
        <div style="background:#000326;padding:18px 24px;">
          <img src="${input.brandLogoUrl}" alt="${input.brandName}" style="height:26px;display:block;" />
        </div>
        <div style="padding:24px;">
          ${input.body
            .split("\n")
            .map((line) => `<p style="margin:0 0 10px 0;line-height:1.45;">${line || "&nbsp;"}</p>`)
            .join("")}
        </div>
        <div style="border-top:1px solid rgba(0,3,38,0.08);padding:14px 24px;font-size:12px;color:#1E64F2;">
          ${input.brandName} · Comunicación automática de facturación
        </div>
      </div>
    </div>
  `;

  if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
      html,
      attachments: [
        {
          filename: input.pdfFilename,
          content: input.pdfBuffer,
        },
      ],
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return {
      provider: "resend",
      messageId: result.data?.id ?? null,
    };
  }

  if (!hasSmtpConfig()) {
    throw new Error("Configura RESEND_API_KEY o credenciales SMTP para enviar correos");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.body,
    html,
    attachments: [
      {
        filename: input.pdfFilename,
        content: input.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return {
    provider: "smtp",
    messageId: info.messageId ?? null,
  };
}
