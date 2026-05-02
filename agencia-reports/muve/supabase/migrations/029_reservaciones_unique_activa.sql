-- ============================================================
-- Migración 029 — Constraint único reservaciones activas
-- ============================================================

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'estado_reserva_enum'
  ) then
    begin
      alter type estado_reserva_enum add value if not exists 'cancelada_sin_devolucion';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservaciones_user_id_horario_id_fecha_key'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'reservaciones_unique_activa'
  ) then
    alter table public.reservaciones
      rename constraint reservaciones_user_id_horario_id_fecha_key to reservaciones_unique_activa;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservaciones_unique_activa'
  ) then
    alter table public.reservaciones
      add constraint reservaciones_unique_activa
      unique (user_id, horario_id, fecha);
  end if;
end
$$;
