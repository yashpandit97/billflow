-- Owner admin: configurable trial, complimentary flag, subscription payments ledger

-- ---------------------------------------------------------------------------
-- Platform settings: trial duration (default 5 minutes for testing)
-- ---------------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists trial_duration_value integer not null default 5
    check (trial_duration_value > 0);

alter table public.platform_settings
  add column if not exists trial_duration_unit text not null default 'minutes'
    check (trial_duration_unit in ('minutes', 'hours', 'days'));

update public.platform_settings
set trial_duration_value = 5,
    trial_duration_unit = 'minutes'
where id = 1;

-- ---------------------------------------------------------------------------
-- Complimentary / waived subscriptions (no earnings)
-- ---------------------------------------------------------------------------
alter table public.tenant_subscriptions
  add column if not exists is_complimentary boolean not null default false;

-- ---------------------------------------------------------------------------
-- Subscription payments (app-owner earnings)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  paid_at timestamptz not null default now(),
  source text not null default 'admin',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_paid_at_idx
  on public.subscription_payments (paid_at desc);

create index if not exists subscription_payments_tenant_idx
  on public.subscription_payments (tenant_id);

alter table public.subscription_payments enable row level security;

create policy "Platform admins can view subscription payments"
  on public.subscription_payments for select
  using (public.is_platform_admin());

create policy "Platform admins can insert subscription payments"
  on public.subscription_payments for insert
  with check (public.is_platform_admin());

-- Service role bypasses RLS; owner admin uses service client.

-- ---------------------------------------------------------------------------
-- Helper: trial interval from platform_settings
-- ---------------------------------------------------------------------------
create or replace function public.platform_trial_interval()
returns interval
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer;
  v_unit text;
begin
  select trial_duration_value, trial_duration_unit
  into v_value, v_unit
  from public.platform_settings
  where id = 1;

  v_value := coalesce(v_value, 5);
  v_unit := coalesce(v_unit, 'minutes');

  if v_unit = 'hours' then
    return make_interval(hours => v_value);
  elsif v_unit = 'days' then
    return make_interval(days => v_value);
  else
    return make_interval(mins => v_value);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_business_with_owner: use configurable trial
-- ---------------------------------------------------------------------------
create or replace function public.create_business_with_owner(
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_website text default null,
  p_tax_id text default null,
  p_currency text default 'INR',
  p_invoice_prefix text default 'INV',
  p_invoice_starting_number integer default 1,
  p_default_tax_rate_bps integer default 0,
  p_tax_enabled boolean default true,
  p_referral_code text default null
)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business public.businesses;
  v_referrer_id uuid;
  v_own_code text;
  v_trial_end timestamptz := now() + public.platform_trial_interval();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.business_members where user_id = v_user_id) then
    raise exception 'user already belongs to a business';
  end if;

  v_own_code := public.generate_referral_code();

  insert into public.businesses (
    name, phone, email, address, website, tax_id, currency, locale,
    invoice_prefix, invoice_starting_number, default_tax_rate_bps, tax_enabled,
    plan, subscription_status, trial_starts_at, trial_ends_at, referral_code
  )
  values (
    p_name,
    nullif(p_phone, ''),
    nullif(p_email, ''),
    nullif(p_address, ''),
    nullif(p_website, ''),
    nullif(p_tax_id, ''),
    coalesce(nullif(p_currency, ''), 'INR'),
    case when coalesce(nullif(p_currency, ''), 'INR') = 'INR' then 'en-IN' else 'en-US' end,
    coalesce(nullif(p_invoice_prefix, ''), 'INV'),
    greatest(coalesce(p_invoice_starting_number, 1), 1),
    greatest(coalesce(p_default_tax_rate_bps, 0), 0),
    coalesce(p_tax_enabled, true),
    'standard',
    'trialing',
    now(),
    v_trial_end,
    v_own_code
  )
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role)
  values (v_business.id, v_user_id, 'owner');

  insert into public.invoice_sequences (tenant_id, current_value)
  values (v_business.id, v_business.invoice_starting_number - 1);

  insert into public.tenant_subscriptions (
    tenant_id, status, trial_started_at, trial_ends_at, amount, currency
  )
  values (
    v_business.id, 'trialing', now(), v_trial_end, 99900, v_business.currency
  );

  update public.profiles set active_business_id = v_business.id where id = v_user_id;

  if p_referral_code is not null and length(trim(p_referral_code)) > 0 then
    select id into v_referrer_id
    from public.businesses
    where referral_code = upper(trim(p_referral_code))
      and id <> v_business.id;

    if v_referrer_id is not null then
      insert into public.referrals (
        referrer_tenant_id, referred_tenant_id, referral_code, status
      )
      values (v_referrer_id, v_business.id, upper(trim(p_referral_code)), 'pending')
      on conflict (referred_tenant_id) do nothing;
    end if;
  end if;

  return v_business;
end;
$$;

-- MRR view: exclude complimentary from paying / mrr
drop view if exists public.subscription_mrr_v;

create view public.subscription_mrr_v as
select
  count(*) filter (where status in ('active', 'trialing')) as total_businesses,
  count(*) filter (where status = 'active' and not is_complimentary) as paying_businesses,
  count(*) filter (where status = 'active' and is_complimentary) as complimentary_businesses,
  count(*) filter (where status = 'trialing') as trial_businesses,
  count(*) filter (where status = 'past_due') as past_due_businesses,
  count(*) filter (where status in ('cancelled', 'expired')) as churned_businesses,
  coalesce(sum(amount) filter (where status = 'active' and not is_complimentary), 0) as mrr_minor
from public.tenant_subscriptions;

revoke all on public.subscription_mrr_v from public;
grant select on public.subscription_mrr_v to authenticated;
grant select on public.subscription_mrr_v to service_role;
