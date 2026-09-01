-- Supplemental policies and admin-only risk RPC

create policy "Members can insert product price history"
  on public.product_price_history for insert
  with check (tenant_id in (select public.user_business_ids()));

revoke select on public.tenant_risk_signals_v from authenticated;
revoke select on public.platform_ledger_v from authenticated;

create or replace function public.get_tenant_risk_signals()
returns setof public.tenant_risk_signals_v
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;
  return query select * from public.tenant_risk_signals_v;
end;
$$;

grant execute on function public.get_tenant_risk_signals() to authenticated;

create or replace function public.get_fee_reconciliation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checked integer;
  v_valid integer;
  v_issues jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select count(*) into v_checked
  from public.bills where status = 'paid';

  select count(*) into v_valid
  from public.bills b
  join public.platform_fee_records f on f.bill_id = b.id and f.record_type = 'fee'
  where b.status = 'paid'
    and f.fee_amount = public.round_half_up(b.total::numeric * f.fee_percentage_bps / 10000);

  select coalesce(jsonb_agg(issue), '[]'::jsonb) into v_issues
  from (
    select jsonb_build_object(
      'type', 'missing_fee',
      'bill_id', b.id,
      'tenant_id', b.tenant_id,
      'invoice_number', b.invoice_number,
      'total', b.total
    ) as issue
    from public.bills b
    left join public.platform_fee_records f
      on f.bill_id = b.id and f.record_type = 'fee'
    where b.status = 'paid' and f.id is null

    union all

    select jsonb_build_object(
      'type', 'fee_mismatch',
      'bill_id', b.id,
      'tenant_id', b.tenant_id,
      'expected', public.round_half_up(b.total::numeric * f.fee_percentage_bps / 10000),
      'actual', f.fee_amount
    )
    from public.bills b
    join public.platform_fee_records f on f.bill_id = b.id and f.record_type = 'fee'
    where b.status = 'paid'
      and f.fee_amount <> public.round_half_up(b.total::numeric * f.fee_percentage_bps / 10000)
  ) q;

  return jsonb_build_object(
    'invoices_checked', v_checked,
    'valid_fees', v_valid,
    'issue_count', jsonb_array_length(v_issues),
    'issues', v_issues
  );
end;
$$;

grant execute on function public.get_fee_reconciliation() to authenticated;
