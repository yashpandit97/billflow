-- Flat 1% platform fee (100 basis points)

update public.platform_settings
set fee_percentage_bps = 100,
    updated_at = now()
where id = 1;

alter table public.platform_settings
  alter column fee_percentage_bps set default 100;

-- Keep historical fee rows unchanged; only new finalizations use the updated setting.
-- Harden RPC default when settings row is missing.
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

  -- Idempotent: one fee per bill
  if exists (
    select 1 from public.platform_fee_records
    where bill_id = p_bill_id and record_type = 'fee'
  ) then
    select * into v_row
    from public.platform_fee_records
    where bill_id = p_bill_id and record_type = 'fee';
    return v_row;
  end if;

  select fee_percentage_bps into v_bps from public.platform_settings where id = 1;
  v_bps := coalesce(v_bps, 100);

  select currency into v_currency from public.businesses where id = v_bill.tenant_id;
  v_currency := coalesce(v_currency, 'INR');

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
    v_currency,
    'fee',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Must be committed before use in later migrations (Postgres enum safety).
alter type public.fee_record_type add value if not exists 'refund_adjustment';
