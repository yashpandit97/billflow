-- Platform fees, UPI payment settings, payment_status, admin access

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.payment_status as enum ('pending', 'paid');
create type public.payment_qr_mode as enum ('uploaded', 'dynamic');
create type public.fee_record_type as enum ('fee', 'reversal');

-- ---------------------------------------------------------------------------
-- Businesses: slug
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column if not exists slug text;

update public.businesses
set slug = lower(regexp_replace(coalesce(name, 'business'), '[^a-zA-Z0-9]+', '-', 'g'))
  || '-' || substr(replace(id::text, '-', ''), 1, 8)
where slug is null;

alter table public.businesses
  alter column slug set not null;

create unique index if not exists businesses_slug_unique on public.businesses (slug);

-- ---------------------------------------------------------------------------
-- Bills: payment_status + cancellation audit
-- ---------------------------------------------------------------------------
alter table public.bills
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null;

-- Existing finalized (paid) bills: treat cash/card as payment received
update public.bills
set payment_status = 'paid'
where status = 'paid'
  and payment_method in ('cash', 'card');

create index if not exists bills_payment_status_idx
  on public.bills (tenant_id, payment_status);

-- ---------------------------------------------------------------------------
-- Payment settings (per tenant)
-- ---------------------------------------------------------------------------
create table public.payment_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  upi_enabled boolean not null default false,
  upi_id text,
  upi_qr_code_url text,
  payment_qr_mode public.payment_qr_mode not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_settings_set_updated_at
  before update on public.payment_settings
  for each row execute function public.set_updated_at();

-- Backfill empty payment_settings for existing businesses
insert into public.payment_settings (business_id)
select id from public.businesses
on conflict (business_id) do nothing;

-- Auto-create payment_settings when a business is created
create or replace function public.ensure_payment_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payment_settings (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists businesses_ensure_payment_settings on public.businesses;
create trigger businesses_ensure_payment_settings
  after insert on public.businesses
  for each row execute function public.ensure_payment_settings();

-- Also create slug on insert if missing (create_business_with_owner)
create or replace function public.ensure_business_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(regexp_replace(coalesce(new.name, 'business'), '[^a-zA-Z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_ensure_slug on public.businesses;
create trigger businesses_ensure_slug
  before insert on public.businesses
  for each row execute function public.ensure_business_slug();

-- ---------------------------------------------------------------------------
-- Platform settings (singleton)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id integer primary key check (id = 1),
  fee_percentage_bps integer not null default 500 check (fee_percentage_bps >= 0),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, fee_percentage_bps)
values (1, 500)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Platform admins
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Platform fee ledger (immutable fee + reversal rows)
-- ---------------------------------------------------------------------------
create table public.platform_fee_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete restrict,
  bill_amount integer not null check (bill_amount >= 0),
  fee_percentage_bps integer not null check (fee_percentage_bps >= 0),
  fee_amount integer not null check (fee_amount >= 0),
  currency text not null default 'INR',
  record_type public.fee_record_type not null,
  reverses_record_id uuid references public.platform_fee_records (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint fee_reversal_requires_parent check (
    (record_type = 'fee' and reverses_record_id is null)
    or (record_type = 'reversal' and reverses_record_id is not null)
  )
);

create unique index platform_fee_one_fee_per_bill
  on public.platform_fee_records (bill_id)
  where record_type = 'fee';

create unique index platform_fee_one_reversal_per_fee
  on public.platform_fee_records (reverses_record_id)
  where record_type = 'reversal';

create index platform_fee_tenant_id_idx on public.platform_fee_records (tenant_id);
create index platform_fee_created_at_idx on public.platform_fee_records (created_at desc);
create index platform_fee_bill_id_idx on public.platform_fee_records (bill_id);
create index platform_fee_record_type_idx on public.platform_fee_records (record_type);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.round_half_up(n numeric)
returns integer
language sql
immutable
as $$
  select (sign(n) * floor(abs(n) + 0.5))::integer;
$$;

-- ---------------------------------------------------------------------------
-- Record platform fee for a finalized bill
-- ---------------------------------------------------------------------------
create or replace function public.record_platform_fee(p_bill_id uuid)
returns public.platform_fee_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.bills;
  v_currency text;
  v_bps integer;
  v_fee integer;
  v_row public.platform_fee_records;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_bill from public.bills where id = p_bill_id for update;
  if not found then
    raise exception 'bill not found';
  end if;

  if not public.is_business_member(v_bill.tenant_id) and not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  if v_bill.status <> 'paid' then
    raise exception 'fee only for finalized bills';
  end if;

  if exists (
    select 1 from public.platform_fee_records
    where bill_id = p_bill_id and record_type = 'fee'
  ) then
    select * into v_row
    from public.platform_fee_records
    where bill_id = p_bill_id and record_type = 'fee';
    return v_row;
  end if;

  select currency into v_currency from public.businesses where id = v_bill.tenant_id;
  select fee_percentage_bps into v_bps from public.platform_settings where id = 1;
  v_bps := coalesce(v_bps, 500);
  v_fee := public.round_half_up(v_bill.total::numeric * v_bps / 10000);

  insert into public.platform_fee_records (
    tenant_id,
    bill_id,
    bill_amount,
    fee_percentage_bps,
    fee_amount,
    currency,
    record_type,
    created_by
  ) values (
    v_bill.tenant_id,
    v_bill.id,
    v_bill.total,
    v_bps,
    v_fee,
    coalesce(v_currency, 'INR'),
    'fee',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.record_platform_fee(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancel bill + fee reversal
-- ---------------------------------------------------------------------------
create or replace function public.cancel_bill_with_fee_reversal(p_bill_id uuid)
returns public.bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.bills;
  v_fee public.platform_fee_records;
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

  update public.bills
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  where id = p_bill_id
  returning * into v_bill;

  select * into v_fee
  from public.platform_fee_records
  where bill_id = p_bill_id and record_type = 'fee'
  for update;

  if found and not exists (
    select 1 from public.platform_fee_records
    where reverses_record_id = v_fee.id and record_type = 'reversal'
  ) then
    insert into public.platform_fee_records (
      tenant_id,
      bill_id,
      bill_amount,
      fee_percentage_bps,
      fee_amount,
      currency,
      record_type,
      reverses_record_id,
      created_by
    ) values (
      v_fee.tenant_id,
      v_fee.bill_id,
      v_fee.bill_amount,
      v_fee.fee_percentage_bps,
      v_fee.fee_amount,
      v_fee.currency,
      'reversal',
      v_fee.id,
      auth.uid()
    );
  end if;

  return v_bill;
end;
$$;

grant execute on function public.cancel_bill_with_fee_reversal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Update create_business_with_owner to set slug (via trigger) — ensure payment_settings
-- Already handled by triggers.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.payment_settings enable row level security;
alter table public.platform_settings enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_fee_records enable row level security;

-- Payment settings: tenant members
create policy "Members can view payment settings"
  on public.payment_settings for select
  using (business_id in (select public.user_business_ids()) or public.is_platform_admin());

create policy "Members can update payment settings"
  on public.payment_settings for update
  using (business_id in (select public.user_business_ids()))
  with check (business_id in (select public.user_business_ids()));

create policy "Members can insert payment settings"
  on public.payment_settings for insert
  with check (business_id in (select public.user_business_ids()));

-- Platform settings: admins only
create policy "Platform admins can view platform settings"
  on public.platform_settings for select
  using (public.is_platform_admin());

create policy "Platform admins can update platform settings"
  on public.platform_settings for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Platform admins table
create policy "Platform admins can view admin list"
  on public.platform_admins for select
  using (public.is_platform_admin() or user_id = auth.uid());

-- Fee records: NO tenant policies. Admins can select. Inserts via SECURITY DEFINER only.
create policy "Platform admins can view fee records"
  on public.platform_fee_records for select
  using (public.is_platform_admin());

-- Platform admins can read all businesses / bills / members for analytics
create policy "Platform admins can view all businesses"
  on public.businesses for select
  using (public.is_platform_admin());

create policy "Platform admins can view all memberships"
  on public.business_members for select
  using (public.is_platform_admin());

create policy "Platform admins can view all bills"
  on public.bills for select
  using (public.is_platform_admin());

create policy "Platform admins can view all bill items"
  on public.bill_items for select
  using (public.is_platform_admin());

create policy "Platform admins can view all profiles"
  on public.profiles for select
  using (public.is_platform_admin());

create policy "Platform admins can view all products"
  on public.products for select
  using (public.is_platform_admin());

create policy "Platform admins can view all customers"
  on public.customers for select
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Storage: upi-qr bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('upi-qr', 'upi-qr', true)
on conflict (id) do nothing;

create policy "Members can upload UPI QR to their tenant folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'upi-qr'
    and (storage.foldername(name))[1]::uuid in (select public.user_business_ids())
  );

create policy "Members can update UPI QR in their tenant folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'upi-qr'
    and (storage.foldername(name))[1]::uuid in (select public.user_business_ids())
  );

create policy "Members can delete UPI QR in their tenant folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'upi-qr'
    and (storage.foldername(name))[1]::uuid in (select public.user_business_ids())
  );

create policy "Public can view UPI QR"
  on storage.objects for select
  using (bucket_id = 'upi-qr');
