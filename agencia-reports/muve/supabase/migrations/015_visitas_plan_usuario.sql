-- ============================================================
-- Migración 015 — Plan de usuario en visitas
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.visitas
  add column if not exists plan_usuario text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'visitas_plan_usuario_check'
  ) then
    alter table public.visitas
      add constraint visitas_plan_usuario_check
      check (plan_usuario in ('basico', 'plus', 'total'));
  end if;
end
$$;
