-- ============================================================
-- Migración 018 — Retención de usuarios y descuentos
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.descuentos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(id) on delete cascade,
  codigo            text unique not null,
  porcentaje        int default 10,
  usado             boolean default false,
  fecha_expiracion  timestamp with time zone,
  created_at        timestamp with time zone default now()
);

create index if not exists descuentos_user_id_idx
  on public.descuentos (user_id);

create index if not exists descuentos_expiracion_idx
  on public.descuentos (fecha_expiracion);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'descuentos_porcentaje_check'
  ) then
    alter table public.descuentos
      add constraint descuentos_porcentaje_check
      check (porcentaje >= 1 and porcentaje <= 100);
  end if;
end
$$;

alter table public.users
  add column if not exists fecha_fin_plan timestamp with time zone;

alter table public.users
  add column if not exists ultimo_checkin timestamp with time zone;

alter table public.descuentos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'descuentos'
      and policyname = 'usuarios ven sus descuentos'
  ) then
    create policy "usuarios ven sus descuentos" on public.descuentos
      for select using (auth.uid() = user_id);
  end if;
end
$$;
