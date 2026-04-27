-- Eliminar política recursiva y reemplazarla
drop policy if exists "admin lee todos los usuarios" on public.users;
drop policy if exists "usuarios actualizan su propio perfil" on public.users;

-- Recrear sin recursión
create policy "usuarios actualizan su propio perfil" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "admin lee todos los usuarios" on public.users
  for select using (
    auth.uid() = id
    or
    (select rol from public.users where id = auth.uid()) = 'admin'
  );
