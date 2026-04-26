-- ============================================================
-- Migración 016 — Stripe Connect + pagos semanales a negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists stripe_account_id text;

create table if not exists public.pagos_negocios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios(id) on delete cascade,
  periodo_inicio date,
  periodo_fin date,
  visitas_basico int default 0,
  visitas_plus int default 0,
  visitas_total int default 0,
  total_mxn int default 0,
  stripe_transfer_id text,
  estado text default 'completado',
  created_at timestamp with time zone default now()
);

create unique index if not exists pagos_negocios_negocio_periodo_unique
  on public.pagos_negocios (negocio_id, periodo_inicio, periodo_fin);

create index if not exists pagos_negocios_negocio_id_idx
  on public.pagos_negocios (negocio_id);

create index if not exists pagos_negocios_periodo_fin_idx
  on public.pagos_negocios (periodo_fin desc);

alter table public.pagos_negocios enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pagos_negocios'
      and policyname = 'staff y admin ven pagos de su negocio'
  ) then
    create policy "staff y admin ven pagos de su negocio" on public.pagos_negocios
      for select using (
        exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and (
              u.rol = 'admin'
              or (u.rol = 'staff' and u.negocio_id = pagos_negocios.negocio_id)
            )
        )
      );
  end if;
end
$$;
