This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
## Flujo de email de bienvenida

Cuando un usuario se registra en `/registro`, el flujo de correo funciona en dos capas:

1. **Confirmación de cuenta (Supabase Auth):**
   - El registro se hace con `supabase.auth.signUp(...)` en `src/app/(public)/registro/page.tsx`.
   - Supabase envía el correo de confirmación usando el template **Confirm signup**.
   - Debe estar habilitado en: `Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup`.

2. **Bienvenida personalizada (API interna):**
   - Después de un `signUp` exitoso, el front llama a `POST /api/email/bienvenida`.
   - El endpoint está en `src/app/api/email/bienvenida/route.ts`.
   - El endpoint envía un correo personalizado usando Resend.

### Variables de entorno requeridas para bienvenida

- `RESEND_API_KEY`: API key de Resend.
- `RESEND_FROM_EMAIL` o `EMAIL_FROM`: remitente del correo (ej. `MUVET <noreply@tudominio.com>`).

Si faltan estas variables, el endpoint responde `503` y no bloquea el registro del usuario.

### Prueba rápida del flujo

1. Verifica que **Confirm signup** esté habilitado en Supabase.
2. Registra un usuario nuevo en `/registro`.
3. Confirma que:
   - llegue el correo de confirmación de Supabase.
   - llegue el correo de bienvenida personalizado enviado por `/api/email/bienvenida`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
