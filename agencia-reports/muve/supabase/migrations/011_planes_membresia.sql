-- ============================================================
-- Migración 011 — Planes de membresía en usuarios y negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists plan_requerido text default 'basico';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'negocios_plan_requerido_check'
  ) then
    alter table public.negocios
      add constraint negocios_plan_requerido_check
      check (plan_requerido in ('basico', 'plus', 'total'));
  end if;
end
$$;

update public.negocios
set plan_requerido = 'basico'
where categoria in ('gimnasio', 'clases');

update public.negocios
set plan_requerido = 'plus'
where categoria = 'estetica';

update public.negocios
set plan_requerido = 'total'
where categoria = 'restaurante';

alter table public.users
  add column if not exists plan text default null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_plan_check'
  ) then
    alter table public.users
      add constraint users_plan_check
      check (plan in ('basico', 'plus', 'total'));
  end if;
end
$$;
