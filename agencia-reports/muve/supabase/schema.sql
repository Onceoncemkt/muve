-- ============================================================
-- MUVE — Schema para Supabase
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enums
create type ciudad_enum as enum ('tulancingo', 'pachuca', 'ensenada');
create type categoria_enum as enum ('gimnasio', 'estetica', 'clases', 'restaurante');
create type rol_enum as enum ('usuario', 'staff', 'admin');

-- ============================================================
-- TABLA: users
-- Extiende auth.users de Supabase
-- ============================================================
create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nombre              text not null,
  email               text not null,
  ciudad              ciudad_enum not null default 'tulancingo',
  plan_activo         boolean not null default false,
  stripe_customer_id  text,
  rol                 rol_enum not null default 'usuario',
  fecha_registro      timestamp with time zone default now()
);

-- ============================================================
-- TABLA: negocios
-- ============================================================
create table public.negocios (
  id                          uuid primary key default gen_random_uuid(),
  nombre                      text not null,
  categoria                   categoria_enum not null,
  ciudad                      ciudad_enum not null,
  direccion                   text not null,
  descripcion                 text,
  imagen_url                  text,
  activo                      boolean not null default true,
  visitas_permitidas_por_mes  int not null default 8
);

-- ============================================================
-- TABLA: visitas
-- ============================================================
create table public.visitas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  fecha         timestamp with time zone default now(),
  validado_por  text
);

-- ============================================================
-- TABLA: qr_tokens
-- ============================================================
create table public.qr_tokens (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  token             text not null unique,
  fecha_expiracion  timestamp with time zone not null,
  usado             boolean not null default false
);

-- Índice para búsqueda rápida por token
create index qr_tokens_token_idx on public.qr_tokens (token);
create index visitas_user_id_idx on public.visitas (user_id);
create index visitas_negocio_id_idx on public.visitas (negocio_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.negocios enable row level security;
alter table public.visitas enable row level security;
alter table public.qr_tokens enable row level security;

-- users
create policy "usuarios leen su propio perfil" on public.users
  for select using (auth.uid() = id);

create policy "usuarios actualizan su propio perfil" on public.users
  for update using (auth.uid() = id);

create policy "admin lee todos los usuarios" on public.users
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

-- negocios (lectura pública para usuarios activos, escritura solo admin)
create policy "negocios activos son publicos" on public.negocios
  for select using (activo = true);

create policy "admin gestiona negocios" on public.negocios
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

-- visitas
create policy "usuarios ven sus visitas" on public.visitas
  for select using (auth.uid() = user_id);

create policy "staff registra visitas" on public.visitas
  for insert with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol in ('staff', 'admin'))
  );

create policy "admin ve todas las visitas" on public.visitas
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

-- qr_tokens
create policy "usuarios ven sus tokens" on public.qr_tokens
  for select using (auth.uid() = user_id);

create policy "usuarios crean sus tokens" on public.qr_tokens
  for insert with check (auth.uid() = user_id);

create policy "staff lee tokens para validar" on public.qr_tokens
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol in ('staff', 'admin'))
  );

create policy "staff actualiza tokens (marcar usado)" on public.qr_tokens
  for update using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol in ('staff', 'admin'))
  );

-- ============================================================
-- TRIGGER: crear perfil al registrarse
-- Supabase llama esto cuando se crea un usuario en auth.users
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, nombre, ciudad)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'ciudad')::ciudad_enum, 'tulancingo')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FUNCIÓN: límite de visitas por mes
-- Devuelve cuántas visitas le quedan al usuario en un negocio
-- ============================================================
create or replace function public.visitas_restantes(p_user_id uuid, p_negocio_id uuid)
returns int
language sql
stable
as $$
  select
    n.visitas_permitidas_por_mes - count(v.id)::int
  from public.negocios n
  left join public.visitas v
    on v.negocio_id = n.id
    and v.user_id = p_user_id
    and date_trunc('month', v.fecha) = date_trunc('month', now())
  where n.id = p_negocio_id
  group by n.visitas_permitidas_por_mes;
$$;

-- ============================================================
-- SEED: negocios demo por ciudad
-- ============================================================
insert into public.negocios (nombre, categoria, ciudad, direccion, descripcion, activo) values
  -- Tulancingo
  ('Iron Gym Tulancingo',   'gimnasio',    'tulancingo', 'Av. Hidalgo 42, Tulancingo',           'Gym completo con pesas libres, máquinas cardio y clases grupales.',        true),
  ('Yoga Zen',              'clases',      'tulancingo', 'Calle Morelos 15, Col. Centro',         'Clases de yoga y meditación para todos los niveles.',                       true),
  ('Bellas Manos Spa',      'estetica',    'tulancingo', 'Blvd. Reyes 88, Tulancingo',            'Tratamientos faciales, masajes y uñas.',                                    true),
  ('Green Bowl',            'restaurante', 'tulancingo', 'Plaza Sendero Local 12, Tulancingo',    'Ensaladas, bowls saludables y jugos naturales.',                             true),
  -- Pachuca
  ('Titan Fitness',         'gimnasio',    'pachuca',    'Blvd. Colosio 120, Pachuca',            'Gym de alto rendimiento con zona CrossFit y pesas.',                        true),
  ('Cycling Pachuca',       'clases',      'pachuca',    'Av. Revolución 55, Col. Centro',        'Clases de cycling indoor con instructores certificados.',                    true),
  ('Nails & Glow',          'estetica',    'pachuca',    'Plaza Las Américas Local 8, Pachuca',   'Servicios de uñas, depilación y lifting de pestañas.',                       true),
  ('Vital Kitchen',         'restaurante', 'pachuca',    'Blvd. Valle de San Javier 200, Pachuca','Menú saludable con opciones veganas y sin gluten.',                         true),
  -- Ensenada
  ('Pacific Gym',           'gimnasio',    'ensenada',   'Blvd. Costero 300, Ensenada',           'Gym con vista al mar, equipamiento completo.',                              true),
  ('Pilates Ensenada',      'clases',      'ensenada',   'Calle Miramar 45, Ensenada',            'Pilates en aparatos y mat, grupos pequeños.',                               true),
  ('Sun Spa',               'estetica',    'ensenada',   'Av. Reforma 18, Col. Centro',           'Masajes, faciales y aromaterapia.',                                         true),
  ('Mar & Verde',           'restaurante', 'ensenada',   'Blvd. Teniente Azueta 88, Ensenada',   'Mariscos saludables y bowls de açaí.',                                      true);
