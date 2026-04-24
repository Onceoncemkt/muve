# Agency Internal Billing App
Sistema interno para administrar clientes, pagos mensuales y recibos digitales.

## Stack base
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (DB + Auth)
- Resend/Nodemailer (emails)
- PDFKit (recibos PDF)
- FullCalendar (vista calendario)

## Instalación
1. Instala dependencias:
   npm install
2. Copia variables de entorno:
   cp .env.example .env.local
3. Levanta el entorno local:
   npm run dev
4. Verifica calidad:
   npm run lint
   npm run typecheck

## Estructura inicial
- `src/app/(auth)`: login y rutas públicas internas.
- `src/app/(dashboard)`: app protegida (dashboard, clientes, pagos, recibos, correos).
- `src/components`: UI compartida (layout, tablas, KPIs, formularios).
- `src/lib`: utilidades globales (env, Supabase, helpers).
- `src/modules`: lógica de negocio por dominio.
- `src/types`: tipos centrales de dominio y base de datos.

## Variables de entorno
Revisa `.env.example`.
- Para correos puedes usar:
  - Resend: `RESEND_API_KEY` + `EMAIL_FROM`
  - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`
## Supabase: migración y seed
1. Instala Supabase CLI (si no lo tienes):
   npm install -g supabase
2. Inicia sesión y vincula el proyecto:
   supabase login
   supabase link --project-ref TU_PROJECT_REF
3. Aplica la migración:
   supabase db push
4. Ejecuta seed de datos de ejemplo:
   supabase db execute --file supabase/seed.sql

## Deploy en Vercel
- Configura las mismas variables de entorno en el proyecto de Vercel.
- Build command: `npm run build`
- Output: Next.js (auto)
