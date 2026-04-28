-- ============================================================
-- Migración 025 — Campos de contacto para perfil de negocio
-- ============================================================

alter table public.negocios
  add column if not exists telefono_contacto text;

alter table public.negocios
  add column if not exists email_contacto text;

alter table public.negocios
  add column if not exists horario_atencion text;
