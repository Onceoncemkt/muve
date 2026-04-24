-- ============================================================
-- Migración 008 — Compatibilidad de columnas opcionales en negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists instagram_handle text;

alter table public.negocios
  add column if not exists capacidad_default int default 10;

alter table public.negocios
  add column if not exists requiere_reserva boolean not null default true;
