ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS plan_negocio TEXT NOT NULL DEFAULT 'basico'
  CHECK (plan_negocio IN ('basico', 'plus', 'total'));
