-- ============================================================
-- Migración 019 — Créditos por ciclo de renovación
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.users
  add column if not exists fecha_inicio_ciclo timestamp with time zone;

-- Backfill para usuarios con plan activo sin fecha de inicio de ciclo.
update public.users
set fecha_inicio_ciclo = coalesce(fecha_inicio_ciclo, coalesce(fecha_fin_plan - interval '1 month', now()))
where plan_activo = true
  and fecha_inicio_ciclo is null;

-- Si hay planes vencidos, desactívalos de inmediato.
update public.users
set plan_activo = false
where plan_activo = true
  and fecha_fin_plan is not null
  and fecha_fin_plan < now();
