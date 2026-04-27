-- ============================================================
-- Migración 023 — Fix recursión RLS en users para perfil
-- ============================================================

drop policy if exists "admin lee todos los usuarios" on public.users;

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and u.rol = 'admin'
  );
end;
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_admin_user(uuid) to anon;

create policy "admin lee todos los usuarios" on public.users
  for select using (
    auth.uid() = id
    or (select public.is_admin_user(auth.uid()))
  );
