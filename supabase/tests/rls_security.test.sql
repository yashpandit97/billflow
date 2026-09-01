-- RLS security checklist (run against local Supabase with test users)
-- Tenant A must not read/write Tenant B rows on core tables.
-- platform_fee_records must deny all tenant SELECT.
-- finalize_bill must be atomic (paid + fee row).

-- Example manual checks:
-- set request.jwt.claim.sub = '<tenant_a_user>';
-- select * from public.bills where tenant_id = '<tenant_b_id>'; -- expect 0 rows
