-- Subscription (₹299/month), referrals, disable platform transaction fees

-- ---------------------------------------------------------------------------
-- Business: referral code + subscription defaults
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column if not exists referral_code text;

create unique index if not exists businesses_referral_code_unique
  on public.businesses (referral_code)
  where referral_code is not null;

-- 30-day trial, standard plan
alter table public.businesses
  alter column plan set default 'standard';

update public.businesses
set plan = 'standard',
    subscription_status = coalesce(subscription_status, 'trialing'),
    trial_starts_at = coalesce(trial_starts_at, created_at),
    trial_ends_at = coalesce(trial_ends_at, created_at + interval '30 days')
where plan = 'free' or plan is null;

-- Disable platform transaction fee (subscription model)
update public.platform_settings set fee_percentage_bps = 0 where id = 1;

-- ---------------------------------------------------------------------------
-- Tenant subscriptions (one per business)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.businesses (id) on delete cascade,
  status public.subscription_status not null default 'trialing',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  amount integer not null default 29900 check (amount > 0),
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_subscriptions_status_idx
  on public.tenant_subscriptions (status);

-- Backfill subscriptions for existing businesses
insert into public.tenant_subscriptions (
  tenant_id, status, trial_started_at, trial_ends_at,
  current_period_start, current_period_end, amount, currency
)
select
  b.id,
  coalesce(b.subscription_status, 'trialing'),
  coalesce(b.trial_starts_at, b.created_at),
  coalesce(b.trial_ends_at, b.created_at + interval '30 days'),
  b.subscription_starts_at,
  b.subscription_ends_at,
  29900,
  coalesce(b.currency, 'INR')
from public.businesses b
on conflict (tenant_id) do nothing;

-- ---------------------------------------------------------------------------
-- Referrals
-- ---------------------------------------------------------------------------
create type public.referral_status as enum (
  'pending',
  'qualified',
  'rewarded',
  'rejected'
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_tenant_id uuid not null references public.businesses (id) on delete cascade,
  referred_tenant_id uuid not null unique references public.businesses (id) on delete cascade,
  referral_code text not null,
  status public.referral_status not null default 'pending',
  reward_months integer not null default 1 check (reward_months > 0),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  constraint referrals_no_self check (referrer_tenant_id <> referred_tenant_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_tenant_id);
create index if not exists referrals_status_idx on public.referrals (status);

-- ---------------------------------------------------------------------------
-- Subscription credits (referral free months)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  credit_type text not null default 'referral_month',
  months integer not null default 1 check (months > 0),
  source text not null default 'referral',
  referral_id uuid unique references public.referrals (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists subscription_credits_tenant_unused_idx
  on public.subscription_credits (tenant_id)
  where used_at is null;

-- ---------------------------------------------------------------------------
-- Referral code generator
-- ---------------------------------------------------------------------------
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1 from public.businesses where referral_code = v_code
    );
    if v_try > 20 then
      raise exception 'could not generate referral code';
    end if;
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Disable platform fee insertion (subscription model)
-- ---------------------------------------------------------------------------
create or replace function public._insert_platform_fee(p_bill_id uuid)
returns public.platform_fee_records
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Platform transaction fees disabled; subscription billing model.
  return null;
end;
$$;

-- finalize_bill without fee
create or replace function public.finalize_bill(
  p_bill_id uuid,
  p_payment_method public.payment_method default null,
  p_payment_status public.payment_status default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.bills;
  v_invoice text;
  v_existing jsonb;
  v_result jsonb;
  v_payment_status public.payment_status;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_idempotency_key is not null then
    select response into v_existing
    from public.bill_idempotency_keys
    where tenant_id = (select tenant_id from public.bills where id = p_bill_id)
      and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  select * into v_bill from public.bills where id = p_bill_id for update;
  if not found then
    raise exception 'bill not found';
  end if;

  if not public.is_business_member(v_bill.tenant_id) then
    raise exception 'not authorized';
  end if;

  if v_bill.status = 'paid' then
    return jsonb_build_object(
      'bill_id', v_bill.id,
      'invoice_number', v_bill.invoice_number,
      'total', v_bill.total,
      'already_finalized', true
    );
  end if;

  if v_bill.status <> 'draft' then
    raise exception 'only draft bills can be finalized';
  end if;

  if not exists (select 1 from public.bill_items where bill_id = p_bill_id) then
    raise exception 'bill has no items';
  end if;

  perform public.billflow_set_trusted_write();
  perform public.recalculate_bill_totals(p_bill_id);

  select * into v_bill from public.bills where id = p_bill_id;

  if v_bill.invoice_number is null then
    select public.next_invoice_number(v_bill.tenant_id) into v_invoice;
  else
    v_invoice := v_bill.invoice_number;
  end if;

  v_payment_status := coalesce(
    p_payment_status,
    case when p_payment_method in ('cash', 'card') then 'paid'::public.payment_status else 'pending'::public.payment_status end
  );

  update public.bills
  set invoice_number = v_invoice,
      status = 'paid',
      finalized_at = now(),
      payment_method = coalesce(p_payment_method, payment_method),
      payment_status = v_payment_status,
      updated_at = now()
  where id = p_bill_id
  returning * into v_bill;

  perform public.write_audit_log(
    v_bill.tenant_id,
    'BILL_FINALIZED',
    'bill',
    v_bill.id,
    jsonb_build_object('invoice_number', v_invoice, 'total', v_bill.total)
  );

  v_result := jsonb_build_object(
    'bill_id', v_bill.id,
    'invoice_number', v_invoice,
    'total', v_bill.total
  );

  if p_idempotency_key is not null then
    insert into public.bill_idempotency_keys (tenant_id, idempotency_key, bill_id, response)
    values (v_bill.tenant_id, p_idempotency_key, v_bill.id, v_result)
    on conflict (tenant_id, idempotency_key) do nothing;
  end if;

  return v_result;
end;
$$;

-- Cancel bill without fee reversal
create or replace function public.cancel_bill_with_fee_reversal(p_bill_id uuid)
returns public.bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.bills;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_bill from public.bills where id = p_bill_id for update;
  if not found then
    raise exception 'bill not found';
  end if;

  if not public.is_business_member(v_bill.tenant_id) then
    raise exception 'not authorized';
  end if;

  if v_bill.status = 'cancelled' then
    return v_bill;
  end if;

  perform public.billflow_set_trusted_write();

  update public.bills
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  where id = p_bill_id
  returning * into v_bill;

  perform public.write_audit_log(
    v_bill.tenant_id,
    'BILL_CANCELLED',
    'bill',
    v_bill.id,
    jsonb_build_object('invoice_number', v_bill.invoice_number)
  );

  return v_bill;
end;
$$;

-- Partial refund without platform fee adjustment
create or replace function public.record_partial_refund(
  p_bill_id uuid,
  p_amount integer,
  p_reason text
)
returns public.bill_refunds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.bills;
  v_prior_refunds integer;
  v_refund public.bill_refunds;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_amount <= 0 or p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'invalid refund';
  end if;

  select * into v_bill from public.bills where id = p_bill_id for update;
  if not found then
    raise exception 'bill not found';
  end if;

  if not public.is_business_member(v_bill.tenant_id) then
    raise exception 'not authorized';
  end if;

  if v_bill.status <> 'paid' then
    raise exception 'refunds only on paid bills';
  end if;

  select coalesce(sum(refund_amount), 0) into v_prior_refunds
  from public.bill_refunds where bill_id = p_bill_id;

  if p_amount > v_bill.total - v_prior_refunds then
    raise exception 'refund exceeds remaining bill amount';
  end if;

  perform public.billflow_set_trusted_write();

  insert into public.bill_refunds (tenant_id, bill_id, refund_amount, reason, created_by)
  values (v_bill.tenant_id, p_bill_id, p_amount, trim(p_reason), auth.uid())
  returning * into v_refund;

  update public.bills
  set refunded_total = v_prior_refunds + p_amount,
      updated_at = now()
  where id = p_bill_id;

  perform public.write_audit_log(
    v_bill.tenant_id,
    'REFUND_CREATED',
    'bill',
    p_bill_id,
    jsonb_build_object('refund_id', v_refund.id, 'amount', p_amount)
  );

  return v_refund;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create business with 30-day trial + referral attribution
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
    now() + interval '30 days',
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
    v_business.id, 'trialing', now(), now() + interval '30 days', 29900, v_business.currency
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

grant execute on function public.create_business_with_owner(
  text, text, text, text, text, text, text, text, integer, integer, boolean, text
) to authenticated;

-- Qualify referral when referred business becomes paying customer
create or replace function public.qualify_referral(p_referred_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_credit_id uuid;
begin
  select * into v_ref
  from public.referrals
  where referred_tenant_id = p_referred_tenant_id
    and status = 'pending'
  for update;

  if not found then
    return;
  end if;

  update public.referrals
  set status = 'qualified', qualified_at = now()
  where id = v_ref.id;

  insert into public.subscription_credits (
    tenant_id, credit_type, months, source, referral_id
  )
  values (
    v_ref.referrer_tenant_id, 'referral_month', 1, 'referral', v_ref.id
  )
  returning id into v_credit_id;

  update public.referrals
  set status = 'rewarded', rewarded_at = now()
  where id = v_ref.id;
end;
$$;

grant execute on function public.qualify_referral(uuid) to authenticated;

-- Consume one credit month (idempotent per billing cycle)
create or replace function public.apply_subscription_billing(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.tenant_subscriptions;
  v_credit public.subscription_credits;
  v_now timestamptz := now();
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'subscription not found';
  end if;

  if v_sub.status = 'trialing' and v_now < v_sub.trial_ends_at then
    return jsonb_build_object('action', 'trial', 'status', v_sub.status);
  end if;

  if v_sub.status = 'trialing' and v_now >= v_sub.trial_ends_at then
    select * into v_credit
    from public.subscription_credits
    where tenant_id = p_tenant_id and used_at is null
    order by created_at
    limit 1
    for update;

    if found then
      update public.subscription_credits set used_at = v_now where id = v_credit.id;
      update public.tenant_subscriptions
      set status = 'active',
          current_period_start = v_now,
          current_period_end = v_now + interval '30 days',
          updated_at = v_now
      where tenant_id = p_tenant_id;
      update public.businesses
      set subscription_status = 'active',
          subscription_starts_at = v_now,
          subscription_ends_at = v_now + interval '30 days'
      where id = p_tenant_id;
      return jsonb_build_object('action', 'credit_applied', 'months', v_credit.months);
    end if;

    update public.tenant_subscriptions
    set status = 'past_due', updated_at = v_now
    where tenant_id = p_tenant_id;
    update public.businesses set subscription_status = 'past_due' where id = p_tenant_id;
    return jsonb_build_object('action', 'payment_required', 'status', 'past_due');
  end if;

  return jsonb_build_object('action', 'none', 'status', v_sub.status);
end;
$$;

grant execute on function public.apply_subscription_billing(uuid) to authenticated;

-- RLS
alter table public.tenant_subscriptions enable row level security;
alter table public.referrals enable row level security;
alter table public.subscription_credits enable row level security;

create policy "Members can view own subscription"
  on public.tenant_subscriptions for select
  using (tenant_id in (select public.user_business_ids()) or public.is_platform_admin());

create policy "Members can view referrals they sent or received"
  on public.referrals for select
  using (
    referrer_tenant_id in (select public.user_business_ids())
    or referred_tenant_id in (select public.user_business_ids())
    or public.is_platform_admin()
  );

create policy "Members can view own subscription credits"
  on public.subscription_credits for select
  using (tenant_id in (select public.user_business_ids()) or public.is_platform_admin());

create policy "Platform admins view all subscriptions"
  on public.tenant_subscriptions for select
  using (public.is_platform_admin());

-- Backfill referral codes for existing businesses
update public.businesses
set referral_code = public.generate_referral_code()
where referral_code is null;

-- Admin MRR view
create or replace view public.subscription_mrr_v as
select
  count(*) filter (where status in ('active', 'trialing')) as total_businesses,
  count(*) filter (where status = 'active') as paying_businesses,
  count(*) filter (where status = 'trialing') as trial_businesses,
  count(*) filter (where status = 'past_due') as past_due_businesses,
  count(*) filter (where status in ('cancelled', 'expired')) as churned_businesses,
  coalesce(sum(amount) filter (where status = 'active'), 0) as mrr_minor
from public.tenant_subscriptions;

revoke all on public.subscription_mrr_v from public;
grant select on public.subscription_mrr_v to authenticated;
