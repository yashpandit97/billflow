-- Financial security: RLS hardening, state machine, idempotency, audit, refunds

-- ---------------------------------------------------------------------------
-- Helpers: trusted write session (SECURITY DEFINER RPCs only)
-- ---------------------------------------------------------------------------
create or replace function public.billflow_set_trusted_write()
returns void
language plpgsql
as $$
begin
  perform set_config('billflow.trusted_write', 'on', true);
end;
$$;

create or replace function public.billflow_is_trusted_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('billflow.trusted_write', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column if not exists allow_cashier_price_override boolean not null default false;

alter table public.bills
  add column if not exists finalized_at timestamptz,
  add column if not exists refunded_total integer not null default 0 check (refunded_total >= 0);

alter table public.bill_items
  add column if not exists catalog_unit_price integer,
  add column if not exists price_override boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists overridden_by uuid references auth.users (id) on delete set null;

update public.bill_items
set catalog_unit_price = unit_price
where catalog_unit_price is null;

alter table public.platform_fee_records
  add column if not exists metadata jsonb;

-- ---------------------------------------------------------------------------
-- Audit & idempotency
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.businesses (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_id_idx on public.audit_logs (tenant_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  old_price integer not null,
  new_price integer not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_price_history_product_idx
  on public.product_price_history (product_id, created_at desc);

create table if not exists public.bill_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  idempotency_key uuid not null,
  bill_id uuid not null references public.bills (id) on delete cascade,
  response jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists public.bill_refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete restrict,
  refund_amount integer not null check (refund_amount > 0),
  reason text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bill_refunds_bill_id_idx on public.bill_refunds (bill_id);

-- ---------------------------------------------------------------------------
-- Internal audit writer (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_tenant_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Bill mutation guards
-- ---------------------------------------------------------------------------
create or replace function public.guard_bill_update()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status in ('paid', 'cancelled') and not public.billflow_is_trusted_write() then
      if new.subtotal is distinct from old.subtotal
        or new.discount is distinct from old.discount
        or new.tax is distinct from old.tax
        or new.total is distinct from old.total
        or new.status is distinct from old.status
        or new.invoice_number is distinct from old.invoice_number
        or new.tenant_id is distinct from old.tenant_id
        or new.refunded_total is distinct from old.refunded_total
      then
        raise exception 'cannot modify finalized bill financial fields';
      end if;
    end if;

    if old.status = 'paid' and new.status = 'draft' then
      raise exception 'illegal transition: paid to draft';
    end if;
    if old.status = 'cancelled' and new.status = 'paid' then
      raise exception 'illegal transition: cancelled to paid';
    end if;
    if old.status = 'cancelled' and new.status = 'draft' then
      raise exception 'illegal transition: cancelled to draft';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_bill_update_trigger on public.bills;
create trigger guard_bill_update_trigger
  before update on public.bills
  for each row execute function public.guard_bill_update();

create or replace function public.guard_bill_items_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status public.bill_status;
begin
  select status into v_status from public.bills where id = coalesce(new.bill_id, old.bill_id);
  if v_status in ('paid', 'cancelled') and not public.billflow_is_trusted_write() then
    raise exception 'cannot modify items on finalized bill';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_bill_items_insert on public.bill_items;
create trigger guard_bill_items_insert
  before insert on public.bill_items
  for each row execute function public.guard_bill_items_mutation();

drop trigger if exists guard_bill_items_update on public.bill_items;
create trigger guard_bill_items_update
  before update on public.bill_items
  for each row execute function public.guard_bill_items_mutation();

drop trigger if exists guard_bill_items_delete on public.bill_items;
create trigger guard_bill_items_delete
  before delete on public.bill_items
  for each row execute function public.guard_bill_items_mutation();

-- ---------------------------------------------------------------------------
-- Recalculate using round_half_up (align with TS)
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

  perform public.billflow_set_trusted_write();

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
          v_share := public.round_half_up((r.line_total::numeric * v_discount) / v_subtotal);
          v_allocated := v_allocated + v_share;
        end if;
      else
        v_share := 0;
      end if;
      v_taxable := greatest(r.line_total - v_share, 0);
      v_tax := v_tax + public.round_half_up((v_taxable::numeric * r.tax_rate_bps) / 10000);
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

revoke all on function public.recalculate_bill_totals(uuid) from public;
revoke all on function public.recalculate_bill_totals(uuid) from authenticated;
revoke all on function public.recalculate_bill_totals(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Internal fee insert (trusted session)
-- ---------------------------------------------------------------------------
create or replace function public._insert_platform_fee(p_bill_id uuid)
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
  select * into v_bill from public.bills where id = p_bill_id;
  if not found then
    raise exception 'bill not found';
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
  v_bps := coalesce(v_bps, 100);
  v_fee := public.round_half_up(v_bill.total::numeric * v_bps / 10000);

  insert into public.platform_fee_records (
    tenant_id, bill_id, bill_amount, fee_percentage_bps, fee_amount,
    currency, record_type, created_by, metadata
  ) values (
    v_bill.tenant_id, v_bill.id, v_bill.total, v_bps, v_fee,
    coalesce(v_currency, 'INR'), 'fee', auth.uid(),
    jsonb_build_object('source', 'finalize')
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalize bill (atomic: status + fee + audit)
-- ---------------------------------------------------------------------------
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
    v_result := jsonb_build_object(
      'bill_id', v_bill.id,
      'invoice_number', v_bill.invoice_number,
      'total', v_bill.total,
      'already_finalized', true
    );
    return v_result;
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

  perform public._insert_platform_fee(p_bill_id);

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

grant execute on function public.finalize_bill(uuid, public.payment_method, public.payment_status, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Create + finalize in one transaction (POS checkout)
-- ---------------------------------------------------------------------------
create or replace function public.create_and_finalize_bill(
  p_customer_id uuid,
  p_bill_discount integer,
  p_payment_method public.payment_method,
  p_payment_status public.payment_status,
  p_notes text,
  p_items jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_bill_id uuid;
  v_item jsonb;
  v_product public.products;
  v_existing jsonb;
  v_finalize jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select business_id into v_tenant_id
  from public.business_members
  where user_id = auth.uid()
  order by created_at
  limit 1;

  if v_tenant_id is null then
    raise exception 'no tenant membership';
  end if;

  if p_idempotency_key is not null then
    select response into v_existing
    from public.bill_idempotency_keys
    where tenant_id = v_tenant_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  perform public.billflow_set_trusted_write();

  insert into public.bills (
    tenant_id, invoice_number, customer_id, subtotal, discount, tax, total,
    status, payment_method, payment_status, notes, created_by
  ) values (
    v_tenant_id, null, p_customer_id, 0, greatest(coalesce(p_bill_discount, 0), 0), 0, 0,
    'draft', p_payment_method, coalesce(p_payment_status, 'pending'::public.payment_status),
    p_notes, auth.uid()
  )
  returning id into v_bill_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and tenant_id = v_tenant_id
      and is_active = true;

    if not found then
      raise exception 'product unavailable';
    end if;

    insert into public.bill_items (
      tenant_id, bill_id, product_id, product_name, sku, quantity,
      unit_price, catalog_unit_price, tax_rate_bps, discount, line_total,
      price_override, override_reason, overridden_by
    ) values (
      v_tenant_id,
      v_bill_id,
      v_product.id,
      v_product.name,
      v_product.sku,
      (v_item->>'quantity')::numeric,
      coalesce((v_item->>'unit_price')::integer, v_product.selling_price),
      v_product.selling_price,
      v_product.tax_rate_bps,
      greatest(coalesce((v_item->>'line_discount')::integer, 0), 0),
      greatest(
        public.round_half_up(
          ((v_item->>'quantity')::numeric * coalesce((v_item->>'unit_price')::integer, v_product.selling_price))
          - greatest(coalesce((v_item->>'line_discount')::integer, 0), 0)
        ),
        0
      ),
      coalesce((v_item->>'price_override')::boolean, false),
      v_item->>'override_reason',
      case when coalesce((v_item->>'price_override')::boolean, false) then auth.uid() else null end
    );
  end loop;

  v_finalize := public.finalize_bill(
    v_bill_id,
    p_payment_method,
    p_payment_status,
    p_idempotency_key
  );

  return v_finalize;
end;
$$;

grant execute on function public.create_and_finalize_bill(uuid, integer, public.payment_method, public.payment_status, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Harden cancel with trusted write + audit
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

  perform public.billflow_set_trusted_write();

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
      tenant_id, bill_id, bill_amount, fee_percentage_bps, fee_amount,
      currency, record_type, reverses_record_id, created_by, metadata
    ) values (
      v_fee.tenant_id, v_fee.bill_id, v_fee.bill_amount, v_fee.fee_percentage_bps,
      v_fee.fee_amount, v_fee.currency, 'reversal', v_fee.id, auth.uid(),
      jsonb_build_object('source', 'cancel')
    );
  end if;

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

-- ---------------------------------------------------------------------------
-- Partial refund
-- ---------------------------------------------------------------------------
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
  v_fee public.platform_fee_records;
  v_prior_refunds integer;
  v_fee_adjustment integer;
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

  select * into v_fee
  from public.platform_fee_records
  where bill_id = p_bill_id and record_type = 'fee';

  if found then
    v_fee_adjustment := public.round_half_up(p_amount::numeric * v_fee.fee_percentage_bps / 10000);
    if v_fee_adjustment > 0 then
      insert into public.platform_fee_records (
        tenant_id, bill_id, bill_amount, fee_percentage_bps, fee_amount,
        currency, record_type, reverses_record_id, created_by, metadata
      ) values (
        v_fee.tenant_id, p_bill_id, p_amount, v_fee.fee_percentage_bps, v_fee_adjustment,
        v_fee.currency, 'refund_adjustment', v_fee.id, auth.uid(),
        jsonb_build_object('refund_id', v_refund.id, 'reason', trim(p_reason))
      );
    end if;
  end if;

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

grant execute on function public.record_partial_refund(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_platform_fee delegates to internal (backward compatible)
-- ---------------------------------------------------------------------------
create or replace function public.record_platform_fee(p_bill_id uuid)
returns public.platform_fee_records
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

  if not public.is_business_member(v_bill.tenant_id) and not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  perform public.billflow_set_trusted_write();
  return public._insert_platform_fee(p_bill_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Narrow RLS: draft-only bill mutations
-- ---------------------------------------------------------------------------
drop policy if exists "Members can update bills" on public.bills;
create policy "Members can update draft bills"
  on public.bills for update
  using (
    tenant_id in (select public.user_business_ids())
    and status = 'draft'
  )
  with check (
    tenant_id in (select public.user_business_ids())
    and status = 'draft'
  );

create policy "Members can update paid bill payment status"
  on public.bills for update
  using (
    tenant_id in (select public.user_business_ids())
    and status = 'paid'
  )
  with check (
    tenant_id in (select public.user_business_ids())
    and status = 'paid'
  );

drop policy if exists "Members can insert bill items" on public.bill_items;
drop policy if exists "Members can update bill items" on public.bill_items;
drop policy if exists "Members can delete bill items" on public.bill_items;

create policy "Members can insert draft bill items"
  on public.bill_items for insert
  with check (
    tenant_id in (select public.user_business_ids())
    and exists (
      select 1 from public.bills b
      where b.id = bill_id and b.status = 'draft'
    )
  );

create policy "Members can update draft bill items"
  on public.bill_items for update
  using (
    tenant_id in (select public.user_business_ids())
    and exists (
      select 1 from public.bills b
      where b.id = bill_id and b.status = 'draft'
    )
  )
  with check (
    tenant_id in (select public.user_business_ids())
    and exists (
      select 1 from public.bills b
      where b.id = bill_id and b.status = 'draft'
    )
  );

create policy "Members can delete draft bill items"
  on public.bill_items for delete
  using (
    tenant_id in (select public.user_business_ids())
    and exists (
      select 1 from public.bills b
      where b.id = bill_id and b.status = 'draft'
    )
  );

-- Audit logs: insert via RPC only; tenant members read own tenant; admins read all
alter table public.audit_logs enable row level security;

create policy "Members can view tenant audit logs"
  on public.audit_logs for select
  using (
    tenant_id in (select public.user_business_ids())
    or public.is_platform_admin()
  );

create policy "Platform admins can view all audit logs"
  on public.audit_logs for select
  using (public.is_platform_admin());

alter table public.product_price_history enable row level security;

create policy "Members can view product price history"
  on public.product_price_history for select
  using (tenant_id in (select public.user_business_ids()) or public.is_platform_admin());

alter table public.bill_refunds enable row level security;

create policy "Members can view bill refunds"
  on public.bill_refunds for select
  using (tenant_id in (select public.user_business_ids()) or public.is_platform_admin());

create policy "Members can insert bill refunds via RPC only"
  on public.bill_refunds for insert
  with check (false);

-- Idempotency keys: no direct tenant access
alter table public.bill_idempotency_keys enable row level security;

-- WhatsApp settings: restrict SELECT to owner/admin
drop policy if exists "Members can view whatsapp settings" on public.whatsapp_settings;

create policy "Owners and admins can view whatsapp settings"
  on public.whatsapp_settings for select
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.member_role[])
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Admin views
-- ---------------------------------------------------------------------------
create or replace view public.platform_ledger_v as
select
  id,
  tenant_id,
  bill_id as invoice_id,
  case record_type
    when 'fee' then 'BILL_FEE'
    when 'reversal' then 'FEE_REVERSAL'
    when 'refund_adjustment' then 'REFUND_ADJUSTMENT'
  end as transaction_type,
  bill_amount as gross_amount,
  fee_percentage_bps as fee_rate_bps,
  fee_amount,
  currency,
  record_type,
  reverses_record_id,
  metadata,
  created_at
from public.platform_fee_records;

create or replace view public.tenant_risk_signals_v as
with stats as (
  select
    b.id as tenant_id,
    b.name,
    count(*) filter (where bills.status = 'draft' and bills.created_at >= now() - interval '30 days') as drafts_30d,
    count(*) filter (where bills.status = 'paid' and bills.created_at >= now() - interval '30 days') as finalized_30d,
    count(*) filter (where bills.status = 'cancelled' and bills.created_at >= now() - interval '90 days') as cancelled_90d,
    count(*) filter (where bills.status = 'paid' and bills.created_at >= now() - interval '90 days') as paid_90d,
    coalesce(sum(bills.total) filter (
      where bills.status = 'paid' and bills.created_at >= date_trunc('month', now())
    ), 0) as volume_this_month,
    coalesce(sum(bills.total) filter (
      where bills.status = 'paid'
        and bills.created_at >= date_trunc('month', now() - interval '1 month')
        and bills.created_at < date_trunc('month', now())
    ), 0) as volume_last_month,
    max(bills.created_at) filter (where bills.status = 'paid') as last_activity
  from public.businesses b
  left join public.bills on bills.tenant_id = b.id
  group by b.id, b.name
),
overrides as (
  select tenant_id, count(*) as override_count
  from public.bill_items
  where price_override = true
    and created_at >= now() - interval '90 days'
  group by tenant_id
)
select
  s.tenant_id,
  s.name,
  s.drafts_30d,
  s.finalized_30d,
  s.cancelled_90d,
  s.paid_90d,
  s.volume_this_month,
  s.volume_last_month,
  s.last_activity,
  coalesce(o.override_count, 0) as price_overrides_90d,
  array_remove(array[
    case when s.finalized_30d > 0 and s.drafts_30d > s.finalized_30d * 10
      then 'UNUSUAL_DRAFT_ACTIVITY' end,
    case when s.volume_last_month > 0 and s.volume_this_month < s.volume_last_month * 0.3
      then 'SIGNIFICANT_USAGE_DROP' end,
    case when s.paid_90d > 0 and s.cancelled_90d::numeric / s.paid_90d > 0.25
      then 'HIGH_CANCELLATION_RATE' end,
    case when s.paid_90d > 0 and coalesce(o.override_count, 0)::numeric / s.paid_90d > 0.5
      then 'HIGH_PRICE_OVERRIDE_ACTIVITY' end
  ], null) as risk_signals
from stats s
left join overrides o on o.tenant_id = s.tenant_id;

grant select on public.platform_ledger_v to authenticated;
grant select on public.tenant_risk_signals_v to authenticated;
