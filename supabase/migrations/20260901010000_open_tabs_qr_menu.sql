-- Restaurant open tabs + per-table QR guest menu

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Business flag
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column if not exists open_tabs_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- Dining tables
-- ---------------------------------------------------------------------------
create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  qr_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (qr_token)
);

create unique index if not exists dining_tables_tenant_name_active_uidx
  on public.dining_tables (tenant_id, lower(name))
  where is_active = true;

create index if not exists dining_tables_tenant_id_idx
  on public.dining_tables (tenant_id);

create trigger dining_tables_set_updated_at
  before update on public.dining_tables
  for each row execute function public.set_updated_at();

alter table public.dining_tables enable row level security;

create policy "Members can view dining tables"
  on public.dining_tables for select
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can insert dining tables"
  on public.dining_tables for insert
  with check (tenant_id in (select public.user_business_ids()));

create policy "Members can update dining tables"
  on public.dining_tables for update
  using (tenant_id in (select public.user_business_ids()));

create policy "Members can delete dining tables"
  on public.dining_tables for delete
  using (tenant_id in (select public.user_business_ids()));

-- ---------------------------------------------------------------------------
-- Bills: tab label, table link, nullable invoice for open drafts
-- ---------------------------------------------------------------------------
alter table public.bills
  add column if not exists tab_label text;

alter table public.bills
  add column if not exists table_id uuid references public.dining_tables (id) on delete set null;

alter table public.bills
  alter column invoice_number drop not null;

alter table public.bills
  drop constraint if exists bills_tenant_id_invoice_number_key;

create unique index if not exists bills_tenant_invoice_number_uidx
  on public.bills (tenant_id, invoice_number)
  where invoice_number is not null;

create unique index if not exists bills_one_open_draft_per_table_uidx
  on public.bills (tenant_id, table_id)
  where status = 'draft' and table_id is not null;

create index if not exists bills_tenant_drafts_idx
  on public.bills (tenant_id, updated_at desc)
  where status = 'draft';

create index if not exists bills_table_id_idx on public.bills (table_id);

-- Members can delete bill_items (used when replacing draft lines)
create policy "Members can delete bill items"
  on public.bill_items for delete
  using (tenant_id in (select public.user_business_ids()));

-- Realtime for live POS sync
do $$
begin
  alter publication supabase_realtime add table public.bills;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bill_items;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Recalculate bill totals from items (mirrors app calculateBill)
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_bill_totals(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_tax_enabled boolean;
  v_bill_discount integer;
  v_subtotal integer := 0;
  v_discount integer;
  v_tax integer := 0;
  v_total integer;
  r record;
  v_allocated integer := 0;
  v_line_count integer := 0;
  v_idx integer := 0;
  v_share integer;
  v_taxable integer;
begin
  select b.tenant_id, b.discount, biz.tax_enabled
  into v_tenant_id, v_bill_discount, v_tax_enabled
  from public.bills b
  join public.businesses biz on biz.id = b.tenant_id
  where b.id = p_bill_id;

  if v_tenant_id is null then
    raise exception 'bill not found';
  end if;

  select coalesce(sum(line_total), 0), count(*)
  into v_subtotal, v_line_count
  from public.bill_items
  where bill_id = p_bill_id;

  v_discount := least(greatest(coalesce(v_bill_discount, 0), 0), v_subtotal);

  if not v_tax_enabled or v_subtotal = 0 then
    v_tax := 0;
  else
    for r in
      select id, line_total, tax_rate_bps
      from public.bill_items
      where bill_id = p_bill_id
      order by created_at, id
    loop
      v_idx := v_idx + 1;
      if v_discount > 0 and v_subtotal > 0 then
        if v_idx = v_line_count then
          v_share := v_discount - v_allocated;
        else
          v_share := round((r.line_total::numeric * v_discount) / v_subtotal);
          v_allocated := v_allocated + v_share;
        end if;
      else
        v_share := 0;
      end if;
      v_taxable := greatest(r.line_total - v_share, 0);
      v_tax := v_tax + round((v_taxable::numeric * r.tax_rate_bps) / 10000);
    end loop;
  end if;

  v_total := v_subtotal - v_discount + v_tax;

  update public.bills
  set subtotal = v_subtotal,
      discount = v_discount,
      tax = v_tax,
      total = v_total,
      updated_at = now()
  where id = p_bill_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public menu (anon-safe)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_menu(p_slug text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_table public.dining_tables%rowtype;
  v_products jsonb;
begin
  if p_slug is null or p_token is null or length(trim(p_slug)) = 0 or length(trim(p_token)) < 16 then
    raise exception 'invalid request';
  end if;

  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug))
  limit 1;

  if not found or not v_business.open_tabs_enabled then
    raise exception 'menu unavailable';
  end if;

  select * into v_table
  from public.dining_tables
  where tenant_id = v_business.id
    and qr_token = trim(p_token)
    and is_active = true
  limit 1;

  if not found then
    raise exception 'invalid table';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'selling_price', p.selling_price,
      'unit', p.unit,
      'category_id', p.category_id
    )
    order by p.name
  ), '[]'::jsonb)
  into v_products
  from public.products p
  where p.tenant_id = v_business.id
    and p.is_active = true;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'slug', v_business.slug,
      'logo_url', v_business.logo_url,
      'currency', v_business.currency,
      'locale', v_business.locale,
      'primary_color', v_business.primary_color,
      'tax_enabled', v_business.tax_enabled
    ),
    'table', jsonb_build_object(
      'id', v_table.id,
      'name', v_table.name
    ),
    'products', v_products
  );
end;
$$;

grant execute on function public.get_public_menu(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest append order (anon-safe)
-- p_items: [{"product_id":"uuid","quantity":1}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.append_guest_order(
  p_slug text,
  p_token text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_table public.dining_tables%rowtype;
  v_bill public.bills%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12, 3);
  v_existing public.bill_items%rowtype;
  v_new_qty numeric(12, 3);
  v_line_net integer;
begin
  if p_slug is null or p_token is null or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid request';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'add at least one item';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'too many items';
  end if;

  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug))
  limit 1;

  if not found or not v_business.open_tabs_enabled then
    raise exception 'ordering unavailable';
  end if;

  select * into v_table
  from public.dining_tables
  where tenant_id = v_business.id
    and qr_token = trim(p_token)
    and is_active = true
  limit 1;

  if not found then
    raise exception 'invalid table';
  end if;

  select * into v_bill
  from public.bills
  where tenant_id = v_business.id
    and table_id = v_table.id
    and status = 'draft'
  limit 1
  for update;

  if not found then
    insert into public.bills (
      tenant_id,
      invoice_number,
      customer_id,
      subtotal,
      discount,
      tax,
      total,
      status,
      payment_method,
      payment_status,
      notes,
      tab_label,
      table_id,
      created_by
    ) values (
      v_business.id,
      null,
      null,
      0,
      0,
      0,
      0,
      'draft',
      null,
      'pending',
      null,
      v_table.name,
      v_table.id,
      null
    )
    returning * into v_bill;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := nullif(v_item ->> 'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and tenant_id = v_business.id
      and is_active = true;

    if not found then
      raise exception 'product unavailable';
    end if;

    select * into v_existing
    from public.bill_items
    where bill_id = v_bill.id
      and product_id = v_product.id
    limit 1
    for update;

    if found then
      v_new_qty := v_existing.quantity + v_qty;
      v_line_net := greatest(round(v_new_qty * v_existing.unit_price) - v_existing.discount, 0)::integer;
      update public.bill_items
      set quantity = v_new_qty,
          line_total = v_line_net
      where id = v_existing.id;
    else
      v_line_net := greatest(round(v_qty * v_product.selling_price), 0)::integer;
      insert into public.bill_items (
        tenant_id,
        bill_id,
        product_id,
        product_name,
        sku,
        quantity,
        unit_price,
        tax_rate_bps,
        discount,
        line_total
      ) values (
        v_business.id,
        v_bill.id,
        v_product.id,
        v_product.name,
        v_product.sku,
        v_qty,
        v_product.selling_price,
        v_product.tax_rate_bps,
        0,
        v_line_net
      );
    end if;
  end loop;

  perform public.recalculate_bill_totals(v_bill.id);

  select * into v_bill from public.bills where id = v_bill.id;

  return jsonb_build_object(
    'bill_id', v_bill.id,
    'tab_label', v_bill.tab_label,
    'table_name', v_table.name,
    'subtotal', v_bill.subtotal,
    'tax', v_bill.tax,
    'total', v_bill.total,
    'item_count', (select count(*) from public.bill_items where bill_id = v_bill.id)
  );
end;
$$;

grant execute on function public.append_guest_order(text, text, jsonb) to anon, authenticated;
