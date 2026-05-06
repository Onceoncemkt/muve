CREATE TABLE IF NOT EXISTS public.prospectos_negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text,
  nombre text,
  ciudad text,
  direccion text,
  instagram text,
  tiktok text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  clientes_mes text,
  tiene_reservas boolean,
  tiene_cuenta_bancaria boolean,
  horario text,
  created_at timestamp DEFAULT now()
);
