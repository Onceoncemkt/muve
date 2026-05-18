ALTER TABLE public.negocios
ADD COLUMN IF NOT EXISTS categorias text[] DEFAULT '{}';

UPDATE public.negocios
SET categorias = ARRAY[categoria]
WHERE categorias = '{}';

ALTER TABLE public.horarios
ADD COLUMN IF NOT EXISTS tipo_servicio text DEFAULT 'clase'
CHECK (tipo_servicio IN ('clase', 'gym'));
