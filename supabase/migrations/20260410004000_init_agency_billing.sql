create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin');
create type public.record_status as enum ('active', 'inactive');
create type public.payment_status as enum ('pending', 'paid', 'overdue');
create type public.email_status as enum ('queued', 'sent', 'failed');
create type public.email_provider as enum ('resend', 'smtp');

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  legal_name text,
  contact_name text,
  email text,
  phone text,
  plan_id uuid references public.plans (id) on update cascade on delete set null,
  custom_service_name text,
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  payment_day smallint not null check (payment_day between 1 and 31),
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on update cascade on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_period_check check (period_end >= period_start),
  constraint payments_due_in_period check (due_date between period_start and period_end),
  unique (client_id, period_start)
);

create sequence if not exists public.receipt_folio_seq start 1 increment 1;

create table if not exists public.invoices_or_receipts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on update cascade on delete cascade,
  payment_id uuid references public.payments (id) on update cascade on delete set null,
  folio text not null unique,
  concept text not null,
  amount numeric(12,2) not null check (amount >= 0),
  period_start date not null,
  period_end date not null,
  issue_date date not null default current_date,
  branding_snapshot jsonb,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_period_check check (period_end >= period_start)
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on update cascade on delete cascade,
  payment_id uuid references public.payments (id) on update cascade on delete set null,
  receipt_id uuid references public.invoices_or_receipts (id) on update cascade on delete set null,
  provider public.email_provider not null,
  to_email text not null,
  subject text not null,
  body text not null,
  status public.email_status not null default 'queued',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_clients_status on public.clients (status);
create index if not exists idx_clients_payment_day on public.clients (payment_day);
create index if not exists idx_payments_client_due_date on public.payments (client_id, due_date);
create index if not exists idx_payments_status_due_date on public.payments (status, due_date);
create index if not exists idx_invoices_client_issue_date on public.invoices_or_receipts (client_id, issue_date);
create index if not exists idx_email_logs_status_created_at on public.email_logs (status, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger trg_plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create trigger trg_clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger trg_payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger trg_invoices_set_updated_at
before update on public.invoices_or_receipts
for each row execute function public.set_updated_at();

create or replace function public.generate_receipt_folio()
returns trigger
language plpgsql
as $$
declare
  seq_number bigint;
begin
  if new.folio is null or btrim(new.folio) = '' then
    seq_number := nextval('public.receipt_folio_seq');
    new.folio := 'REC-' || to_char(current_date, 'YYYYMM') || '-' || lpad(seq_number::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_invoices_generate_folio
before insert on public.invoices_or_receipts
for each row execute function public.generate_receipt_folio();

create or replace function public.mark_overdue_payments()
returns void
language plpgsql
as $$
begin
  update public.payments
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;
end;
$$;

create or replace function public.generate_monthly_payments(target_month date default date_trunc('month', current_date)::date)
returns integer
language plpgsql
as $$
declare
  first_day date := date_trunc('month', target_month)::date;
  last_day date := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;
  inserted_count integer := 0;
begin
  insert into public.payments (
    client_id,
    period_start,
    period_end,
    due_date,
    amount,
    status
  )
  select
    c.id,
    first_day,
    last_day,
    make_date(extract(year from first_day)::int, extract(month from first_day)::int, least(c.payment_day, extract(day from last_day)::int)),
    c.monthly_amount,
    'pending'
  from public.clients c
  where c.status = 'active'
    and not exists (
      select 1
      from public.payments p
      where p.client_id = c.id
        and p.period_start = first_day
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.clients enable row level security;
alter table public.payments enable row level security;
alter table public.invoices_or_receipts enable row level security;
alter table public.email_logs enable row level security;

create policy "admin full access users" on public.users
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admin full access plans" on public.plans
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admin full access clients" on public.clients
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admin full access payments" on public.payments
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admin full access invoices" on public.invoices_or_receipts
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admin full access email_logs" on public.email_logs
for all
using (public.is_admin())
with check (public.is_admin());
