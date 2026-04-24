-- ============================================================
-- Migración 004 — Sistema de reservaciones
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── Enums nuevos ─────────────────────────────────────────────
create type dia_semana_enum as enum
  ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');

create type estado_reserva_enum as enum
  ('confirmada','cancelada','completada');

-- ── requiere_reserva en negocios ─────────────────────────────
alter table public.negocios
  add column if not exists requiere_reserva boolean not null default true;

-- Restaurantes son de acceso directo
update public.negocios set requiere_reserva = false where categoria = 'restaurante';

-- ── Tabla horarios ────────────────────────────────────────────
create table public.horarios (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null references public.negocios(id) on delete cascade,
  dia_semana       dia_semana_enum not null,
  hora_inicio      time not null,
  hora_fin         time not null,
  capacidad_total  int not null default 10,
  activo           boolean not null default true
);

create index horarios_negocio_idx on public.horarios (negocio_id);

-- ── Tabla reservaciones ───────────────────────────────────────
create table public.reservaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  horario_id  uuid not null references public.horarios(id) on delete cascade,
  fecha       date not null,
  estado      estado_reserva_enum not null default 'confirmada',
  created_at  timestamp with time zone default now(),
  -- Un usuario no puede reservar el mismo horario dos veces en el mismo día
  unique (user_id, horario_id, fecha)
);

create index reservaciones_user_idx     on public.reservaciones (user_id);
create index reservaciones_horario_idx  on public.reservaciones (horario_id, fecha);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.horarios enable row level security;
alter table public.reservaciones enable row level security;

-- horarios: lectura pública, escritura solo staff/admin
create policy "horarios son publicos" on public.horarios
  for select using (true);

create policy "staff gestiona horarios" on public.horarios
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol in ('staff','admin'))
  );

-- reservaciones: cada usuario ve las suyas
create policy "usuario ve sus reservaciones" on public.reservaciones
  for select using (auth.uid() = user_id);

create policy "usuario crea sus reservaciones" on public.reservaciones
  for insert with check (auth.uid() = user_id);

create policy "usuario cancela sus reservaciones" on public.reservaciones
  for update using (auth.uid() = user_id);

-- staff ve reservaciones de negocios que gestiona (todos sus horarios)
create policy "staff ve reservaciones de su negocio" on public.reservaciones
  for select using (
    exists (
      select 1
      from   public.horarios h
      join   public.users u on u.id = auth.uid()
      where  h.id = reservaciones.horario_id
        and  u.rol in ('staff','admin')
    )
  );

create policy "staff completa reservaciones" on public.reservaciones
  for update using (
    exists (
      select 1
      from   public.horarios h
      join   public.users u on u.id = auth.uid()
      where  h.id = reservaciones.horario_id
        and  u.rol in ('staff','admin')
    )
  );

create policy "admin ve todas las reservaciones" on public.reservaciones
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );
