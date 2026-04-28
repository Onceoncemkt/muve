create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists wallet_apple_agregado boolean not null default false;

    alter table public.users
      add column if not exists wallet_google_agregado boolean not null default false;
  end if;
end
$$;

create index if not exists users_qr_hash_idx
  on public.users ((encode(digest((id)::text, 'sha256'::text), 'hex')));

drop table if exists public.qr_tokens cascade;

create or replace function public.buscar_usuario_por_qr_hash(p_hash text)
returns table (
  user_id uuid,
  nombre text,
  ciudad ciudad_enum,
  plan_activo boolean,
  plan text,
  fecha_inicio_ciclo timestamp with time zone,
  fecha_fin_plan timestamp with time zone,
  creditos_extra int
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    u.id as user_id,
    u.nombre,
    u.ciudad,
    u.plan_activo,
    u.plan,
    u.fecha_inicio_ciclo,
    u.fecha_fin_plan,
    u.creditos_extra
  from public.users u
  where encode(digest(u.id::text, 'sha256'::text), 'hex') = lower(trim(p_hash))
  limit 1;
$$;

revoke all on function public.buscar_usuario_por_qr_hash(text) from public;
grant execute on function public.buscar_usuario_por_qr_hash(text) to authenticated;
grant execute on function public.buscar_usuario_por_qr_hash(text) to anon;
