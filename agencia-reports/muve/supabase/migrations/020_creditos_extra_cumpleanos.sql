-- ============================================================
-- Migración 020 — Créditos extra por cumpleaños
-- ============================================================

alter table public.users
  add column if not exists creditos_extra int not null default 0;

create table if not exists public.creditos_historial (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  cantidad int not null,
  motivo text not null,
  created_at timestamp with time zone default now()
);

create index if not exists creditos_historial_user_id_idx
  on public.creditos_historial (user_id);

create index if not exists creditos_historial_created_at_idx
  on public.creditos_historial (created_at desc);

alter table public.creditos_historial enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creditos_historial'
      and policyname = 'usuarios ven su historial de creditos'
  ) then
    create policy "usuarios ven su historial de creditos"
      on public.creditos_historial
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;
