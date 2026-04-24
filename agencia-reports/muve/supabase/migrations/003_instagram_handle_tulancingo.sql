-- ============================================================
-- Migración 003 — instagram_handle + negocios reales Tulancingo
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Nueva columna (idempotente)
alter table public.negocios
  add column if not exists instagram_handle text;

-- 2. Reemplazar negocios placeholder de Tulancingo (clases y gimnasio)
--    Se eliminan por nombre para evitar romper visitas de otras ciudades.
delete from public.negocios
where ciudad = 'tulancingo'
  and categoria in ('clases', 'gimnasio');

-- 3. Insertar negocios reales de Tulancingo
insert into public.negocios
  (nombre, categoria, ciudad, direccion, descripcion, instagram_handle, activo, visitas_permitidas_por_mes)
values
  ('Heaven Studio',         'clases',   'tulancingo', 'Tulancingo, Hgo.', 'Indoor cycling de alta intensidad con instructores certificados.',            'heaventstudio',        true, 8),
  ('Mentor Training Center','clases',   'tulancingo', 'Tulancingo, Hgo.', 'Entrenamiento funcional y hyrox para todos los niveles.',                       'mentor.trainingcenter', true, 8),
  ('MOV Reformer',          'clases',   'tulancingo', 'Tulancingo, Hgo.', 'Pilates reformer en estudio boutique, grupos reducidos.',                       'movreformer',          true, 8),
  ('Studio 22:22',          'clases',   'tulancingo', 'Tulancingo, Hgo.', 'Barre, pilates mat y entrenamiento funcional en un mismo espacio.',             'stdio22.22',           true, 8),
  ('Mundo Fit',             'gimnasio', 'tulancingo', 'Tulancingo, Hgo.', 'Gym completo con pesas, cardio, clases grupales y área funcional.',             'mundofittulancingo',   true, 8);
