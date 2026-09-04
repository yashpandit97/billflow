-- Subscription price: ₹999/month (all features), was ₹299

alter table public.tenant_subscriptions
  alter column amount set default 99900;

update public.tenant_subscriptions
set amount = 99900, updated_at = now()
where amount = 29900;

-- Keep create_business_with_owner in sync (₹999 trial amount)
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
    v_business.id, 'trialing', now(), now() + interval '30 days', 99900, v_business.currency
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
