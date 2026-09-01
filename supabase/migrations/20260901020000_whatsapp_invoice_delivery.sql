-- WhatsApp invoice delivery + tenant/platform WhatsApp settings stubs

-- ---------------------------------------------------------------------------
-- Tenant WhatsApp settings (credentials server-side only; never select tokens to client)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  whatsapp_enabled boolean not null default false,
  whatsapp_business_account_id text,
  whatsapp_phone_number_id text,
  -- Encrypted/secret storage: only accessible via service role / server actions that scrub
  whatsapp_access_token text,
  whatsapp_message_template text default 'invoice_delivery',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger whatsapp_settings_set_updated_at
  before update on public.whatsapp_settings
  for each row execute function public.set_updated_at();

alter table public.whatsapp_settings enable row level security;

-- Members can view non-secret columns via a view; table policies allow select of row
-- but app must never send access_token to the browser.
create policy "Members can view whatsapp settings"
  on public.whatsapp_settings for select
  using (business_id in (select public.user_business_ids()) or public.is_platform_admin());

create policy "Members can insert whatsapp settings"
  on public.whatsapp_settings for insert
  with check (
    business_id in (select public.user_business_ids())
    and public.has_business_role(business_id, array['owner','admin']::public.member_role[])
  );

create policy "Members can update whatsapp settings"
  on public.whatsapp_settings for update
  using (
    business_id in (select public.user_business_ids())
    and public.has_business_role(business_id, array['owner','admin']::public.member_role[])
  )
  with check (
    business_id in (select public.user_business_ids())
    and public.has_business_role(business_id, array['owner','admin']::public.member_role[])
  );

-- Auto-create empty settings on business create
create or replace function public.ensure_whatsapp_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.whatsapp_settings (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists businesses_ensure_whatsapp_settings on public.businesses;
create trigger businesses_ensure_whatsapp_settings
  after insert on public.businesses
  for each row execute function public.ensure_whatsapp_settings();

insert into public.whatsapp_settings (business_id)
select id from public.businesses
on conflict (business_id) do nothing;

-- ---------------------------------------------------------------------------
-- Platform-level WhatsApp config (future central provider)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_whatsapp_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  meta_app_id text,
  meta_app_secret text,
  webhook_verify_token text,
  default_template_name text default 'invoice_delivery',
  updated_at timestamptz not null default now()
);

insert into public.platform_whatsapp_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_whatsapp_settings enable row level security;

create policy "Platform admins manage platform whatsapp settings"
  on public.platform_whatsapp_settings for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Delivery tracking
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.whatsapp_delivery_status as enum (
    'pending',
    'sent',
    'delivered',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_provider as enum (
    'cloud_api',
    'wa_me_deeplink',
    'manual'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_invoice_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  phone_number text not null,
  provider public.whatsapp_provider not null default 'cloud_api',
  status public.whatsapp_delivery_status not null default 'pending',
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_deliveries_tenant_idx
  on public.whatsapp_invoice_deliveries (tenant_id, created_at desc);

create index if not exists whatsapp_deliveries_bill_idx
  on public.whatsapp_invoice_deliveries (bill_id, created_at desc);

create index if not exists whatsapp_deliveries_status_idx
  on public.whatsapp_invoice_deliveries (tenant_id, status);

create index if not exists whatsapp_deliveries_provider_msg_idx
  on public.whatsapp_invoice_deliveries (provider_message_id)
  where provider_message_id is not null;

alter table public.whatsapp_invoice_deliveries enable row level security;

create policy "Members can view own whatsapp deliveries"
  on public.whatsapp_invoice_deliveries for select
  using (tenant_id in (select public.user_business_ids()) or public.is_platform_admin());

create policy "Members can insert own whatsapp deliveries"
  on public.whatsapp_invoice_deliveries for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update own whatsapp deliveries"
  on public.whatsapp_invoice_deliveries for update
  using (tenant_id in (select public.user_business_ids()) or public.is_platform_admin());

-- Platform admins can view all (already covered by is_platform_admin in select)
create policy "Platform admins can view all whatsapp deliveries"
  on public.whatsapp_invoice_deliveries for select
  using (public.is_platform_admin());
