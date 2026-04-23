-- Agrega el stripe_subscription_id a users para poder cancelar/consultar suscripciones
alter table public.users
  add column if not exists stripe_subscription_id text;

-- Índice para búsqueda rápida desde el webhook (busca por customer_id)
create index if not exists users_stripe_customer_id_idx on public.users (stripe_customer_id);
