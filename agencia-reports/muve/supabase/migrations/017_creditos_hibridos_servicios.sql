-- ============================================================
-- Migración 017 — Créditos híbridos wellness y restaurantes
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.negocios
  add column if not exists monto_maximo_visita int default 0;

alter table public.negocios
  add column if not exists servicios_incluidos text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'negocios_monto_maximo_visita_check'
  ) then
    alter table public.negocios
      add constraint negocios_monto_maximo_visita_check
      check (monto_maximo_visita >= 0);
  end if;
end
$$;

create table if not exists public.negocio_servicios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  precio_normal_mxn int not null default 0,
  descripcion text,
  activo boolean not null default true,
  created_at timestamp with time zone default now()
);

create index if not exists negocio_servicios_negocio_id_idx
  on public.negocio_servicios (negocio_id);

create index if not exists negocio_servicios_activo_idx
  on public.negocio_servicios (negocio_id, activo);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'negocio_servicios_precio_normal_check'
  ) then
    alter table public.negocio_servicios
      add constraint negocio_servicios_precio_normal_check
      check (precio_normal_mxn >= 0);
  end if;
end
$$;

alter table public.negocio_servicios enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'negocio_servicios'
      and policyname = 'servicios wellness son publicos'
  ) then
    create policy "servicios wellness son publicos" on public.negocio_servicios
      for select using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'negocio_servicios'
      and policyname = 'staff gestiona servicios wellness'
  ) then
    create policy "staff gestiona servicios wellness" on public.negocio_servicios
      for all using (
        exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.rol in ('staff', 'admin')
        )
      );
  end if;
end
$$;

alter table public.reservaciones
  add column if not exists servicio_id uuid references public.negocio_servicios(id) on delete set null;

alter table public.reservaciones
  add column if not exists servicio_nombre text;

alter table public.reservaciones
  add column if not exists servicio_precio_normal_mxn int;
