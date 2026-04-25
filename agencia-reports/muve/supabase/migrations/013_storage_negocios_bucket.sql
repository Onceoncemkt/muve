-- ============================================================
-- Migración 013 — bucket públicos de imágenes para negocios
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

insert into storage.buckets (id, name, public)
values ('negocios', 'negocios', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "negocios storage lectura publica" on storage.objects;
create policy "negocios storage lectura publica"
  on storage.objects
  for select
  to public
  using (bucket_id = 'negocios');

drop policy if exists "negocios storage escritura staff admin" on storage.objects;
create policy "negocios storage escritura staff admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'negocios'
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.rol in ('admin', 'staff')
    )
  );

drop policy if exists "negocios storage actualizacion staff admin" on storage.objects;
create policy "negocios storage actualizacion staff admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'negocios'
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.rol in ('admin', 'staff')
    )
  )
  with check (
    bucket_id = 'negocios'
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.rol in ('admin', 'staff')
    )
  );

drop policy if exists "negocios storage borrado staff admin" on storage.objects;
create policy "negocios storage borrado staff admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'negocios'
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.rol in ('admin', 'staff')
    )
  );
