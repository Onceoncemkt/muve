-- ============================================================
-- MUVE — Schema para Supabase
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enums
create type ciudad_enum as enum ('tulancingo', 'pachuca', 'ensenada', 'tijuana');
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
  plan                text check (plan in ('basico', 'plus', 'total')),
  rol                 rol_enum not null default 'usuario',
  fecha_fin_plan      timestamp with time zone,
  ultimo_checkin      timestamp with time zone,
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
  instagram_handle            text,
  tiktok_handle               text,
  stripe_account_id           text,
  monto_maximo_visita         int not null default 0,
  servicios_incluidos         text,
  requiere_reserva            boolean not null default true,
  capacidad_default           int default 10,
  plan_requerido              text default 'basico' check (plan_requerido in ('basico', 'plus', 'total')),
  activo                      boolean not null default true,
  visitas_permitidas_por_mes  int not null default 8
);
create table public.negocio_servicios (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references public.negocios(id) on delete cascade,
  nombre            text not null,
  precio_normal_mxn int not null default 0,
  descripcion       text,
  activo            boolean not null default true,
  created_at        timestamp with time zone default now()
);

alter table public.users
  add column if not exists negocio_id uuid references public.negocios(id);

-- ============================================================
-- TABLA: visitas
-- ============================================================
create table public.visitas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  fecha         timestamp with time zone default now(),
  validado_por  text,
  plan_usuario  text check (plan_usuario in ('basico', 'plus', 'total'))
);
-- ============================================================
-- TABLA: pagos_negocios
-- ============================================================
create table public.pagos_negocios (
  id                 uuid primary key default gen_random_uuid(),
  negocio_id         uuid references public.negocios(id) on delete cascade,
  periodo_inicio     date,
  periodo_fin        date,
  visitas_basico     int default 0,
  visitas_plus       int default 0,
  visitas_total      int default 0,
  total_mxn          int default 0,
  stripe_transfer_id text,
  estado             text default 'completado',
  created_at         timestamp with time zone default now()
);

create unique index pagos_negocios_negocio_periodo_unique
  on public.pagos_negocios (negocio_id, periodo_inicio, periodo_fin);

-- ============================================================
-- TABLA: descuentos
-- ============================================================
create table public.descuentos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(id) on delete cascade,
  codigo            text unique not null,
  porcentaje        int default 10 check (porcentaje >= 1 and porcentaje <= 100),
  usado             boolean default false,
  fecha_expiracion  timestamp with time zone,
  created_at        timestamp with time zone default now()
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

-- ============================================================
-- TABLA: push_subscriptions
-- ============================================================
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete cascade,
  subscription  jsonb not null,
  created_at    timestamp default now()
);

-- Índice para búsqueda rápida por token
create index qr_tokens_token_idx on public.qr_tokens (token);
create index visitas_user_id_idx on public.visitas (user_id);
create index visitas_negocio_id_idx on public.visitas (negocio_id);
create index users_negocio_id_idx on public.users (negocio_id);
create index descuentos_user_id_idx on public.descuentos (user_id);
create index descuentos_expiracion_idx on public.descuentos (fecha_expiracion);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index negocio_servicios_negocio_id_idx on public.negocio_servicios (negocio_id);
create index negocio_servicios_activo_idx on public.negocio_servicios (negocio_id, activo);
create index pagos_negocios_negocio_id_idx on public.pagos_negocios (negocio_id);
create index pagos_negocios_periodo_fin_idx on public.pagos_negocios (periodo_fin desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.negocios enable row level security;
alter table public.negocio_servicios enable row level security;
alter table public.visitas enable row level security;
alter table public.pagos_negocios enable row level security;
alter table public.descuentos enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.push_subscriptions enable row level security;

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

-- negocio_servicios
create policy "servicios wellness son publicos" on public.negocio_servicios
  for select using (true);

create policy "staff gestiona servicios wellness" on public.negocio_servicios
  for all using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.rol in ('staff', 'admin')
    )
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

-- pagos_negocios
create policy "staff y admin ven pagos de su negocio" on public.pagos_negocios
  for select using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and (
          u.rol = 'admin'
          or (u.rol = 'staff' and u.negocio_id = pagos_negocios.negocio_id)
        )
    )
  );

-- descuentos
create policy "usuarios ven sus descuentos" on public.descuentos
  for select using (auth.uid() = user_id);

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

-- push_subscriptions
create policy "usuarios gestionan sus push subscriptions" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- storage (bucket público de imágenes para negocios)
insert into storage.buckets (id, name, public)
values ('negocios', 'negocios', true)
on conflict (id) do update
set public = excluded.public;

create policy "negocios storage lectura publica" on storage.objects
  for select
  to public
  using (bucket_id = 'negocios');

create policy "negocios storage escritura staff admin" on storage.objects
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

create policy "negocios storage actualizacion staff admin" on storage.objects
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

create policy "negocios storage borrado staff admin" on storage.objects
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
  ('Heaven Studio',          'clases',      'tulancingo', 'Tulancingo, Hgo.', 'Indoor cycling de alta intensidad con instructores certificados.',         true),
  ('Mentor Training Center', 'clases',      'tulancingo', 'Tulancingo, Hgo.', 'Entrenamiento funcional y hyrox para todos los niveles.',                  true),
  ('MOV Reformer',           'clases',      'tulancingo', 'Tulancingo, Hgo.', 'Pilates reformer en estudio boutique, grupos reducidos.',                  true),
  ('Studio 22:22',           'clases',      'tulancingo', 'Tulancingo, Hgo.', 'Barre, pilates mat y entrenamiento funcional en un mismo espacio.',        true),
  ('Mundo Fit',              'gimnasio',    'tulancingo', 'Tulancingo, Hgo.', 'Gym completo con pesas, cardio, clases grupales y área funcional.',        true),
  ('Bellas Manos Spa',       'estetica',    'tulancingo', 'Blvd. Reyes 88, Tulancingo',  'Tratamientos faciales, masajes y uñas.',                        true),
  ('Green Bowl',             'restaurante', 'tulancingo', 'Plaza Sendero Local 12, Tulancingo', 'Ensaladas, bowls saludables y jugos naturales.',          true),
  -- Pachuca
  ('Titan Fitness',         'gimnasio',    'pachuca',    'Blvd. Colosio 120, Pachuca',            'Gym de alto rendimiento con zona CrossFit y pesas.',                        true),
  ('Cycling Pachuca',       'clases',      'pachuca',    'Av. Revolución 55, Col. Centro',        'Clases de cycling indoor con instructores certificados.',                    true),
  ('Nails & Glow',          'estetica',    'pachuca',    'Plaza Las Américas Local 8, Pachuca',   'Servicios de uñas, depilación y lifting de pestañas.',                       true),
  ('Vital Kitchen',         'restaurante', 'pachuca',    'Blvd. Valle de San Javier 200, Pachuca','Menú saludable con opciones veganas y sin gluten.',                         true),
  -- Ensenada
  ('Pacific Gym',           'gimnasio',    'ensenada',   'Blvd. Costero 300, Ensenada',           'Gym con vista al mar, equipamiento completo.',                              true),
  ('Pilates Ensenada',      'clases',      'ensenada',   'Calle Miramar 45, Ensenada',            'Pilates en aparatos y mat, grupos pequeños.',                               true),
  ('Sun Spa',               'estetica',    'ensenada',   'Av. Reforma 18, Col. Centro',           'Masajes, faciales y aromaterapia.',                                         true),
  ('Mar & Verde',           'restaurante', 'ensenada',   'Blvd. Teniente Azueta 88, Ensenada',   'Mariscos saludables y bowls de açaí.',                                      true),
  -- Tijuana
  ('Symmetry Gym',            'gimnasio',    'tijuana', 'Blvd. Agua Caliente, Plaza Galerías Hipódromo, Tijuana', 'Gym premium con clases de yoga, spinning, HIIT, pilates y entrenamiento funcional.', true),
  ('Vertical Climb',          'clases',      'tijuana', 'Blvd. Agua Caliente, Tijuana',                            'Estudio boutique fitness con programas Versa y Fuerza, entrenamientos semi personalizados.', true),
  ('Gladiators Gym & Fitness','gimnasio',    'tijuana', 'C. Real del Mar 10450, Francisco Zarco, Tijuana',         'Cadena de gimnasios con pesas, cardio, clases grupales y entrenamiento personalizado.', true),
  ('Acuario Fitness Center',  'clases',      'tijuana', 'Av. Paseo del Lago 19507, Lago Sur, Tijuana',             'Centro de fitness integral con enfoque médico y nutricional, spinning y clases grupales.', true),
  ('Impact Fitness',          'gimnasio',    'tijuana', 'Tijuana, B.C.',                                           'Gym moderno con yoga, pilates, cardio y clases grupales dinámicas.', true),
  ('Olympus Gym & Fitness',   'gimnasio',    'tijuana', 'Tijuana, B.C.',                                           'Espacio premium con musculación, cardio, clases grupales y nutrición.', true),
  ('Spa del Río',             'estetica',    'tijuana', 'P.º del Río 6641, Río Tijuana, Tijuana',                  'Masajes, faciales y tratamientos corporales en zona Río.', true),
  ('Green Bowl TJ',           'restaurante', 'tijuana', 'Zona Río, Tijuana',                                       'Bowls saludables, jugos y proteínas. Cocina fit en zona Río.', true);

update public.negocios
set plan_requerido = 'basico'
where categoria in ('gimnasio', 'clases');

update public.negocios
set plan_requerido = 'plus'
where categoria = 'estetica';

update public.negocios
set plan_requerido = 'total'
where categoria = 'restaurante';

do $$
begin
  alter table public.negocios
    add column if not exists monto_maximo_visita int default 0;

  alter table public.negocios
    add column if not exists servicios_incluidos text;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'negocios_monto_maximo_visita_check'
  ) then
    alter table public.negocios
      add constraint negocios_monto_maximo_visita_check
      check (monto_maximo_visita >= 0);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists fecha_fin_plan timestamp with time zone;

    alter table public.users
      add column if not exists ultimo_checkin timestamp with time zone;
  end if;
end
$$;

do $$
begin
  create table if not exists public.descuentos (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid references public.users(id) on delete cascade,
    codigo            text unique not null,
    porcentaje        int default 10,
    usado             boolean default false,
    fecha_expiracion  timestamp with time zone,
    created_at        timestamp with time zone default now()
  );

  create index if not exists descuentos_user_id_idx
    on public.descuentos (user_id);

  create index if not exists descuentos_expiracion_idx
    on public.descuentos (fecha_expiracion);

  if not exists (
    select 1
    from pg_constraint
    where conname = 'descuentos_porcentaje_check'
  ) then
    alter table public.descuentos
      add constraint descuentos_porcentaje_check
      check (porcentaje >= 1 and porcentaje <= 100);
  end if;
end
$$;

do $$
begin
  alter table public.descuentos enable row level security;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'descuentos'
      and policyname = 'usuarios ven sus descuentos'
  ) then
    create policy "usuarios ven sus descuentos" on public.descuentos
      for select using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  create table if not exists public.negocio_servicios (
    id uuid primary key default gen_random_uuid(),
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    nombre text not null,
    precio_normal_mxn int not null default 0,
    descripcion text,
    activo boolean not null default true,
    created_at timestamp with time zone default now()
  );

  create index if not exists negocio_servicios_negocio_id_idx
    on public.negocio_servicios (negocio_id);

  create index if not exists negocio_servicios_activo_idx
    on public.negocio_servicios (negocio_id, activo);

  if not exists (
    select 1
    from pg_constraint
    where conname = 'negocio_servicios_precio_normal_check'
  ) then
    alter table public.negocio_servicios
      add constraint negocio_servicios_precio_normal_check
      check (precio_normal_mxn >= 0);
  end if;
end
$$;

do $$
begin
  alter table public.negocio_servicios enable row level security;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'negocio_servicios'
      and policyname = 'servicios wellness son publicos'
  ) then
    create policy "servicios wellness son publicos" on public.negocio_servicios
      for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'negocio_servicios'
      and policyname = 'staff gestiona servicios wellness'
  ) then
    create policy "staff gestiona servicios wellness" on public.negocio_servicios
      for all using (
        exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.rol in ('staff', 'admin')
        )
      );
  end if;
end
$$;

do $$
begin
  if to_regclass('public.reservaciones') is not null then
    alter table public.reservaciones
      add column if not exists servicio_id uuid references public.negocio_servicios(id) on delete set null;

    alter table public.reservaciones
      add column if not exists servicio_nombre text;

    alter table public.reservaciones
      add column if not exists servicio_precio_normal_mxn int;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.horarios') is not null then
    alter table public.horarios
      add column if not exists nombre_coach text;

    alter table public.horarios
      add column if not exists tipo_clase text;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.visitas') is not null then
    alter table public.visitas
      add column if not exists plan_usuario text;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'visitas_plan_usuario_check'
    ) then
      alter table public.visitas
        add constraint visitas_plan_usuario_check
        check (plan_usuario in ('basico', 'plus', 'total'));
    end if;
  end if;
end
$$;
