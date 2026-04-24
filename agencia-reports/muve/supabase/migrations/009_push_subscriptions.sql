-- ============================================================
-- Migración 009 — Suscripciones push por usuario
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamp default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);
