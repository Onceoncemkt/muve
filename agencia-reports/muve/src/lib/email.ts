export function getEmailFrom(): string {
  const email = process.env.RESEND_FROM_EMAIL || 'hola@muvet.mx'
  return `MUVET Wellness Club <${email}>`
}
