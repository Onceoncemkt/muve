-- ============================================================
-- Migración 007 — compatibilidad requiere_reserva en negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists requiere_reserva boolean not null default true;

update public.negocios
set requiere_reserva = false
where categoria = 'restaurante'
  and requiere_reserva is distinct from false;
