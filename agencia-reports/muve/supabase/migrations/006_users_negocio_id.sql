ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios(id);

CREATE INDEX IF NOT EXISTS users_negocio_id_idx ON public.users(negocio_id);
