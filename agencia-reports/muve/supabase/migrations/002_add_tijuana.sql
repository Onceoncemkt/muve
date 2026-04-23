-- ============================================================
-- Migración 002 — Agregar Tijuana como ciudad
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Ampliar el enum (IF NOT EXISTS hace la migración idempotente)
alter type ciudad_enum add value if not exists 'tijuana';

-- 2. Seed de negocios en Tijuana
insert into public.negocios (nombre, categoria, ciudad, direccion, descripcion, activo) values
  ('Symmetry Gym',           'gimnasio',    'tijuana', 'Blvd. Agua Caliente, Plaza Galerías Hipódromo, Tijuana', 'Gym premium con clases de yoga, spinning, HIIT, pilates y entrenamiento funcional.', true),
  ('Vertical Climb',         'clases',      'tijuana', 'Blvd. Agua Caliente, Tijuana',                            'Estudio boutique fitness con programas Versa y Fuerza, entrenamientos semi personalizados.', true),
  ('Gladiators Gym & Fitness','gimnasio',   'tijuana', 'C. Real del Mar 10450, Francisco Zarco, Tijuana',         'Cadena de gimnasios con pesas, cardio, clases grupales y entrenamiento personalizado.', true),
  ('Acuario Fitness Center',  'clases',     'tijuana', 'Av. Paseo del Lago 19507, Lago Sur, Tijuana',             'Centro de fitness integral con enfoque médico y nutricional, spinning y clases grupales.', true),
  ('Impact Fitness',          'gimnasio',   'tijuana', 'Tijuana, B.C.',                                           'Gym moderno con yoga, pilates, cardio y clases grupales dinámicas.', true),
  ('Olympus Gym & Fitness',   'gimnasio',   'tijuana', 'Tijuana, B.C.',                                           'Espacio premium con musculación, cardio, clases grupales y nutrición.', true),
  ('Spa del Río',             'estetica',   'tijuana', 'P.º del Río 6641, Río Tijuana, Tijuana',                  'Masajes, faciales y tratamientos corporales en zona Río.', true),
  ('Green Bowl TJ',           'restaurante','tijuana', 'Zona Río, Tijuana',                                       'Bowls saludables, jugos y proteínas. Cocina fit en zona Río.', true);
