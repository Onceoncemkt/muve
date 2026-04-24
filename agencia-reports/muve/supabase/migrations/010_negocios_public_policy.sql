alter table if exists public.negocios enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'negocios'
      and policyname = 'negocios activos son publicos'
  ) then
    create policy "negocios activos son publicos"
      on public.negocios
      for select
      using (activo = true);
  end if;
end
$$;
