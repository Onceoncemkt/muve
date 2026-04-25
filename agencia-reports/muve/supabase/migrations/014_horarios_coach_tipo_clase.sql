-- ============================================================
-- Migración 014 — Coach y tipo de clase en horarios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.horarios
  add column if not exists nombre_coach text;

alter table public.horarios
  add column if not exists tipo_clase text;
