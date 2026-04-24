-- ============================================================
-- Migración 012 — tiktok_handle opcional en negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists tiktok_handle text;
