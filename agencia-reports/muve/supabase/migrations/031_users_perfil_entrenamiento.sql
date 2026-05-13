ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lesiones text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS objetivo_entrenamiento text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nivel_condicion text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disciplinas text[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notas_negocio text;
