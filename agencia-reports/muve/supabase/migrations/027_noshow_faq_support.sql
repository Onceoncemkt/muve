-- ============================================================
-- Migración 027 — No-show y suspensión de reservaciones
-- ============================================================

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'estado_reserva_enum'
  ) then
    begin
      alter type estado_reserva_enum add value if not exists 'no_show';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end
$$;

alter table public.users
  add column if not exists reservas_suspendidas_hasta timestamp with time zone;

alter table public.visitas
  add column if not exists estado text not null default 'asistio';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'visitas_estado_check'
  ) then
    alter table public.visitas
      add constraint visitas_estado_check
      check (estado in ('asistio', 'no_show', 'cancelado'));
  end if;
end
$$;
