insert into public.plans (name, description, monthly_amount)
values
  ('BÁSICO', 'Plan básico mensual', 6000),
  ('BÁSICO 2026', 'Plan básico versión 2026', 9000),
  ('FULL', 'Plan full mensual', 12000),
  ('SHOOTING', 'Producción shooting', 5000),
  ('VIDEO INSTITUCIONAL', 'Producción de video institucional', 30000),
  ('MASTER', 'Plan master mensual', 15000),
  ('BASICO 2025', 'Plan básico versión 2025', 7000)
on conflict (name) do nothing;

with selected_plans as (
  select id, name, monthly_amount
  from public.plans
)
insert into public.clients (
  business_name,
  legal_name,
  contact_name,
  email,
  phone,
  plan_id,
  custom_service_name,
  monthly_amount,
  payment_day,
  status,
  notes
)
select
  'Nativa Estudio',
  'Nativa Estudio Creativo S.A. de C.V.',
  'Laura Pérez',
  'laura@nativaestudio.mx',
  '+52 55 1111 2222',
  sp.id,
  null,
  sp.monthly_amount,
  5,
  'active',
  'Cliente prioritario con revisión quincenal.'
from selected_plans sp
where sp.name = 'FULL'
and not exists (select 1 from public.clients c where c.business_name = 'Nativa Estudio')
union all
select
  'Comercial Delta',
  'Comercial Delta S. de R.L. de C.V.',
  'Mario Gómez',
  'mario@comercialdelta.com',
  '+52 81 3333 4444',
  sp.id,
  null,
  sp.monthly_amount,
  12,
  'active',
  'Solicita recibo el mismo día de pago.'
from selected_plans sp
where sp.name = 'BÁSICO 2026'
and not exists (select 1 from public.clients c where c.business_name = 'Comercial Delta')
union all
select
  'Studio Verde',
  'Studio Verde Digital S.A.P.I. de C.V.',
  'Ana Ruiz',
  'ana@studioverde.mx',
  '+52 33 5555 6666',
  sp.id,
  null,
  sp.monthly_amount,
  18,
  'active',
  'Acepta transferencia y tarjeta.'
from selected_plans sp
where sp.name = 'BASICO 2025'
and not exists (select 1 from public.clients c where c.business_name = 'Studio Verde');

select public.generate_monthly_payments(date_trunc('month', current_date)::date);

insert into public.invoices_or_receipts (
  client_id,
  payment_id,
  folio,
  concept,
  amount,
  period_start,
  period_end,
  issue_date,
  branding_snapshot
)
select
  c.id,
  p.id,
  '',
  'Servicio mensual de marketing digital',
  p.amount,
  p.period_start,
  p.period_end,
  current_date,
  jsonb_build_object(
    'agency_name', 'Tu Agencia',
    'primary_color', '#0f172a',
    'secondary_color', '#334155'
  )
from public.payments p
join public.clients c on c.id = p.client_id
where p.period_start = date_trunc('month', current_date)::date
  and not exists (
    select 1
    from public.invoices_or_receipts r
    where r.payment_id = p.id
  );
