-- ============================================================
-- Migración 005 — capacidad_default en negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists capacidad_default int default 10;

-- visitas_permitidas_por_mes se mantiene por compatibilidad histórica,
-- pero deja de usarse para lógica de límite por negocio.
