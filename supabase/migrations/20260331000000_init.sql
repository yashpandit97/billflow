-- Billflow multi-tenant schema with RLS
-- Single shared database; isolation via tenant_id + membership

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'staff');
create type public.bill_status as enum ('draft', 'paid', 'cancelled');
create type public.payment_method as enum (
  'cash',
  'card',
  'upi',
  'bank_transfer',
  'other'
);
create type public.invoice_style as enum ('a4', 'thermal');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'none'
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  active_business_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Businesses (tenants)
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  tax_id text,
  currency text not null default 'INR',
  locale text not null default 'en-IN',
  invoice_prefix text not null default 'INV',
  invoice_starting_number integer not null default 1 check (invoice_starting_number >= 1),
  default_tax_rate_bps integer not null default 0 check (default_tax_rate_bps >= 0),
  tax_enabled boolean not null default true,
  invoice_footer text,
  payment_instructions text,
  primary_color text not null default '#18181b',
  secondary_color text not null default '#71717a',
  invoice_style public.invoice_style not null default 'a4',
  plan text not null default 'free',
  subscription_status public.subscription_status not null default 'trialing',
  trial_starts_at timestamptz default now(),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  subscription_starts_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_active_business_id_fkey
  foreign key (active_business_id) references public.businesses (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);
create index business_members_business_id_idx on public.business_members (business_id);

-- ---------------------------------------------------------------------------
-- Invoice sequences (atomic numbering)
-- ---------------------------------------------------------------------------
create table public.invoice_sequences (
  tenant_id uuid primary key references public.businesses (id) on delete cascade,
  current_value integer not null default 0 check (current_value >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index categories_tenant_id_idx on public.categories (tenant_id);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  sku text,
  description text,
  selling_price integer not null check (selling_price >= 0),
  cost_price integer check (cost_price is null or cost_price >= 0),
  unit text not null default 'pcs',
  tax_rate_bps integer not null default 0 check (tax_rate_bps >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_tenant_id_idx on public.products (tenant_id);
create index products_tenant_name_idx on public.products (tenant_id, name);
create index products_tenant_sku_idx on public.products (tenant_id, sku);
create index products_tenant_active_idx on public.products (tenant_id, is_active);
create unique index products_tenant_sku_unique
  on public.products (tenant_id, sku)
  where sku is not null and sku <> '';

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  tax_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_tenant_id_idx on public.customers (tenant_id);
create index customers_tenant_name_idx on public.customers (tenant_id, name);
create index customers_tenant_phone_idx on public.customers (tenant_id, phone);

-- ---------------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  invoice_number text not null,
  customer_id uuid references public.customers (id) on delete set null,
  subtotal integer not null check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  tax integer not null default 0 check (tax >= 0),
  total integer not null check (total >= 0),
  status public.bill_status not null default 'paid',
  payment_method public.payment_method,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create index bills_tenant_id_idx on public.bills (tenant_id);
create index bills_tenant_created_at_idx on public.bills (tenant_id, created_at desc);
create index bills_tenant_status_idx on public.bills (tenant_id, status);
create index bills_tenant_customer_idx on public.bills (tenant_id, customer_id);
create index bills_invoice_number_idx on public.bills (tenant_id, invoice_number);

-- ---------------------------------------------------------------------------
-- Bill items (historical snapshots)
-- ---------------------------------------------------------------------------
create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  sku text,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps >= 0),
  discount integer not null default 0 check (discount >= 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index bill_items_tenant_id_idx on public.bill_items (tenant_id);
create index bill_items_bill_id_idx on public.bill_items (bill_id);
create index bill_items_product_id_idx on public.bill_items (product_id);

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile creation on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.user_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.business_members
  where user_id = auth.uid();
$$;

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_business_role(
  p_business_id uuid,
  p_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and role = any (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Atomic invoice number generation
-- ---------------------------------------------------------------------------
create or replace function public.next_invoice_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  if auth.uid() is null or not public.is_business_member(p_tenant_id) then
    raise exception 'not authorized';
  end if;

  select invoice_prefix
  into v_prefix
  from public.businesses
  where id = p_tenant_id;

  if v_prefix is null then
    raise exception 'business not found';
  end if;

  update public.invoice_sequences
  set current_value = current_value + 1,
      updated_at = now()
  where tenant_id = p_tenant_id
  returning current_value into v_next;

  if v_next is null then
    raise exception 'invoice sequence missing';
  end if;

  return v_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

grant execute on function public.next_invoice_number(uuid) to authenticated;
grant execute on function public.user_business_ids() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, public.member_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Create business + owner membership (atomic onboarding)
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
  p_tax_enabled boolean default true
)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business public.businesses;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1 from public.business_members where user_id = v_user_id
  ) then
    raise exception 'user already belongs to a business';
  end if;

  insert into public.businesses (
    name,
    phone,
    email,
    address,
    website,
    tax_id,
    currency,
    locale,
    invoice_prefix,
    invoice_starting_number,
    default_tax_rate_bps,
    tax_enabled
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
    coalesce(p_tax_enabled, true)
  )
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role)
  values (v_business.id, v_user_id, 'owner');

  insert into public.invoice_sequences (tenant_id, current_value)
  values (v_business.id, v_business.invoice_starting_number - 1);

  update public.profiles
  set active_business_id = v_business.id
  where id = v_user_id;

  return v_business;
end;
$$;

grant execute on function public.create_business_with_owner(
  text, text, text, text, text, text, text, text, integer, integer, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Businesses
create policy "Members can view their businesses"
  on public.businesses for select
  using (id in (select public.user_business_ids()));

create policy "Owners and admins can update business"
  on public.businesses for update
  using (public.has_business_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_business_role(id, array['owner', 'admin']::public.member_role[]));

-- Business members
create policy "Members can view memberships of their businesses"
  on public.business_members for select
  using (
    user_id = auth.uid()
    or business_id in (select public.user_business_ids())
  );

create policy "Owners can manage memberships"
  on public.business_members for all
  using (public.has_business_role(business_id, array['owner']::public.member_role[]))
  with check (public.has_business_role(business_id, array['owner']::public.member_role[]));

-- Invoice sequences (read-only for members; updates via SECURITY DEFINER RPC)
create policy "Members can view invoice sequences"
  on public.invoice_sequences for select
  using (tenant_id in (select public.user_business_ids()));

-- Categories
create policy "Members can view categories"
  on public.categories for select
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can insert categories"
  on public.categories for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update categories"
  on public.categories for update
  using (tenant_id in (select public.user_business_ids()))
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can delete categories"
  on public.categories for delete
  using (tenant_id in (select public.user_business_ids()));

-- Products
create policy "Members can view products"
  on public.products for select
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can insert products"
  on public.products for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update products"
  on public.products for update
  using (tenant_id in (select public.user_business_ids()))
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can delete products"
  on public.products for delete
  using (tenant_id in (select public.user_business_ids()));

-- Customers
create policy "Members can view customers"
  on public.customers for select
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can insert customers"
  on public.customers for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update customers"
  on public.customers for update
  using (tenant_id in (select public.user_business_ids()))
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can delete customers"
  on public.customers for delete
  using (tenant_id in (select public.user_business_ids()));

-- Bills
create policy "Members can view bills"
  on public.bills for select
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can insert bills"
  on public.bills for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update bills"
  on public.bills for update
  using (tenant_id in (select public.user_business_ids()))
  with check (tenant_id in (select public.user_business_ids()));

-- Bill items
create policy "Members can view bill items"
  on public.bill_items for select
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can insert bill items"
  on public.bill_items for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update bill items"
  on public.bill_items for update
  using (tenant_id in (select public.user_business_ids()))
  with check (tenant_id in (select public.user_business_ids()));

-- ---------------------------------------------------------------------------
-- Storage: logos bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "Members can upload logos to their tenant folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1]::uuid in (select public.user_business_ids())
  );

create policy "Members can update logos in their tenant folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1]::uuid in (select public.user_business_ids())
  );

create policy "Members can delete logos in their tenant folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1]::uuid in (select public.user_business_ids())
  );

create policy "Public can view logos"
  on storage.objects for select
  using (bucket_id = 'logos');
