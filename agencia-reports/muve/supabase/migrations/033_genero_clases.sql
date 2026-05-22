-- Género de usuario y filtro de clases por género.
--
-- NOTA: en producción ambas columnas ya existen:
--   - users.genero se creó en la migración 021 con valores
--     ('masculino','femenino','prefiero_no_decir'). Se conserva ese constraint;
--     la app muestra las etiquetas "Hombre"/"Mujer" pero guarda los valores
--     internos masculino/femenino para no romper el CHECK existente.
--   - horarios.tipo_clase_genero ya existe con default 'mixta'.
-- Este archivo deja la definición idempotente para entornos nuevos.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS genero text
  CHECK (genero IN ('masculino', 'femenino', 'prefiero_no_decir'));

ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS tipo_clase_genero text
  DEFAULT 'mixta'
  CHECK (tipo_clase_genero IN ('mixta', 'mujeres', 'hombres'));
