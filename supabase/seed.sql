-- Demo seed for local development (Urban Cafe)
-- NOTE: Auth users must exist first. Prefer the documented signup flow,
-- or create users in Supabase Auth then re-run relevant inserts.
-- This seed is safe to run after migrations; it uses fixed UUIDs.

-- For automated local demos, create auth users via Supabase Studio / Admin API:
--   owner@urbancafe.demo / password: demo-password-123
-- Then replace :owner_user_id below, or use the helper script in README.

do $$
declare
  v_user_id uuid;
  v_business_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cat_drinks uuid := '22222222-2222-2222-2222-222222222201';
  v_cat_food uuid := '22222222-2222-2222-2222-222222222202';
  v_p1 uuid := '33333333-3333-3333-3333-333333333301';
  v_p2 uuid := '33333333-3333-3333-3333-333333333302';
  v_p3 uuid := '33333333-3333-3333-3333-333333333303';
  v_p4 uuid := '33333333-3333-3333-3333-333333333304';
  v_p5 uuid := '33333333-3333-3333-3333-333333333305';
  v_c1 uuid := '44444444-4444-4444-4444-444444444401';
  v_c2 uuid := '44444444-4444-4444-4444-444444444402';
  v_c3 uuid := '44444444-4444-4444-4444-444444444403';
  v_b1 uuid := '55555555-5555-5555-5555-555555555501';
  v_b2 uuid := '55555555-5555-5555-5555-555555555502';
  v_b3 uuid := '55555555-5555-5555-5555-555555555503';
begin
  -- Pick the first auth user if present (local convenience). Skip if none.
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise notice 'No auth.users found — skip Urban Cafe seed. Sign up first, then re-run seed.';
    return;
  end if;

  insert into public.businesses (
    id, name, address, phone, email, tax_id, currency, locale,
    invoice_prefix, invoice_starting_number, default_tax_rate_bps, tax_enabled,
    invoice_footer, payment_instructions, primary_color, secondary_color,
    invoice_style, plan, subscription_status
  ) values (
    v_business_id,
    'Urban Cafe',
    E'12 MG Road\nBengaluru, KA 560001',
    '+91 98765 43210',
    'hello@urbancafe.demo',
    '29ABCDE1234F1Z5',
    'INR',
    'en-IN',
    'INV',
    1,
    1800,
    true,
    'Thank you for visiting Urban Cafe!',
    'UPI: urbancafe@upi',
    '#18181b',
    '#71717a',
    'a4',
    'free',
    'trialing'
  )
  on conflict (id) do nothing;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, v_user_id, 'owner')
  on conflict (business_id, user_id) do nothing;

  insert into public.invoice_sequences (tenant_id, current_value)
  values (v_business_id, 3)
  on conflict (tenant_id) do update set current_value = greatest(public.invoice_sequences.current_value, 3);

  update public.profiles
  set active_business_id = v_business_id
  where id = v_user_id;

  insert into public.categories (id, tenant_id, name) values
    (v_cat_drinks, v_business_id, 'Drinks'),
    (v_cat_food, v_business_id, 'Food')
  on conflict do nothing;

  insert into public.products (
    id, tenant_id, category_id, name, sku, selling_price, unit, tax_rate_bps, is_active
  ) values
    (v_p1, v_business_id, v_cat_drinks, 'Cappuccino', 'DRK-CAP', 15000, 'cup', 1800, true),
    (v_p2, v_business_id, v_cat_drinks, 'Latte', 'DRK-LAT', 16000, 'cup', 1800, true),
    (v_p3, v_business_id, v_cat_drinks, 'Espresso', 'DRK-ESP', 10000, 'shot', 1800, true),
    (v_p4, v_business_id, v_cat_food, 'Sandwich', 'FD-SND', 18000, 'pcs', 500, true),
    (v_p5, v_business_id, v_cat_food, 'Chocolate Cake', 'FD-CAK', 22000, 'slice', 500, true)
  on conflict (id) do nothing;

  insert into public.customers (id, tenant_id, name, phone, email) values
    (v_c1, v_business_id, 'Rahul Sharma', '+91 90000 11111', 'rahul@example.com'),
    (v_c2, v_business_id, 'Priya Patel', '+91 90000 22222', 'priya@example.com'),
    (v_c3, v_business_id, 'Walk-in Customer', null, null)
  on conflict (id) do nothing;

  insert into public.bills (
    id, tenant_id, invoice_number, customer_id, subtotal, discount, tax, total,
    status, payment_method, payment_status, created_by
  ) values
    (v_b1, v_business_id, 'INV-000001', v_c1, 30000, 0, 5400, 35400, 'paid', 'upi', 'pending', v_user_id),
    (v_b2, v_business_id, 'INV-000002', v_c2, 40000, 5000, 6300, 41300, 'paid', 'card', 'paid', v_user_id),
    (v_b3, v_business_id, 'INV-000003', v_c3, 22000, 0, 1100, 23100, 'paid', 'cash', 'paid', v_user_id)
  on conflict (tenant_id, invoice_number) do nothing;

  insert into public.bill_items (
    tenant_id, bill_id, product_id, product_name, sku, quantity, unit_price, tax_rate_bps, discount, line_total
  )
  select * from (values
    (v_business_id, v_b1, v_p1, 'Cappuccino', 'DRK-CAP', 2::numeric, 15000, 1800, 0, 30000),
    (v_business_id, v_b2, v_p2, 'Latte', 'DRK-LAT', 1::numeric, 16000, 1800, 0, 16000),
    (v_business_id, v_b2, v_p4, 'Sandwich', 'FD-SND', 1::numeric, 18000, 500, 0, 18000),
    (v_business_id, v_b2, v_p3, 'Espresso', 'DRK-ESP', 1::numeric, 10000, 1800, 0, 10000),
    (v_business_id, v_b3, v_p5, 'Chocolate Cake', 'FD-CAK', 1::numeric, 22000, 500, 0, 22000)
  ) as t(tenant_id, bill_id, product_id, product_name, sku, quantity, unit_price, tax_rate_bps, discount, line_total)
  where not exists (select 1 from public.bill_items bi where bi.bill_id = v_b1 limit 1);

  insert into public.payment_settings (
    business_id, upi_enabled, upi_id, payment_qr_mode
  ) values (
    v_business_id, true, 'urbancafe@upi', 'uploaded'
  )
  on conflict (business_id) do update
  set upi_enabled = true,
      upi_id = excluded.upi_id;

  insert into public.platform_fee_records (
    tenant_id, bill_id, bill_amount, fee_percentage_bps, fee_amount, currency, record_type, created_by
  )
  select v_business_id, v_b1, 35400, 100, 354, 'INR', 'fee', v_user_id
  where exists (select 1 from public.bills where id = v_b1)
    and not exists (select 1 from public.platform_fee_records where bill_id = v_b1 and record_type = 'fee');

  insert into public.platform_fee_records (
    tenant_id, bill_id, bill_amount, fee_percentage_bps, fee_amount, currency, record_type, created_by
  )
  select v_business_id, v_b2, 41300, 100, 413, 'INR', 'fee', v_user_id
  where exists (select 1 from public.bills where id = v_b2)
    and not exists (select 1 from public.platform_fee_records where bill_id = v_b2 and record_type = 'fee');

  insert into public.platform_fee_records (
    tenant_id, bill_id, bill_amount, fee_percentage_bps, fee_amount, currency, record_type, created_by
  )
  select v_business_id, v_b3, 23100, 100, 231, 'INR', 'fee', v_user_id
  where exists (select 1 from public.bills where id = v_b3)
    and not exists (select 1 from public.platform_fee_records where bill_id = v_b3 and record_type = 'fee');

  insert into public.platform_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  raise notice 'Urban Cafe demo data seeded for user % (also platform admin)', v_user_id;
end $$;
