-- ============================================================
-- Migración 028 — Historial de créditos con otorgado_por
-- ============================================================

alter table public.creditos_historial
  add column if not exists otorgado_por text not null default 'sistema';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creditos_historial_otorgado_por_check'
  ) then
    alter table public.creditos_historial
      add constraint creditos_historial_otorgado_por_check
      check (otorgado_por in ('admin', 'sistema'));
  end if;
end
$$;

create index if not exists creditos_historial_otorgado_por_idx
  on public.creditos_historial (otorgado_por, created_at desc);
