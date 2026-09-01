# Row Level Security Matrix (internal)

## Tenant isolation

All tenant tables scope access via `tenant_id IN (SELECT user_business_ids())`.

| Table | Tenant SELECT | Tenant INSERT | Tenant UPDATE | Tenant DELETE |
|-------|---------------|---------------|---------------|---------------|
| products | members | members | members | members |
| customers | members | members | members | members |
| bills | members | members | draft only | denied |
| bill_items | members | draft parent | draft parent | draft parent |
| payment_settings | members | members | members | — |
| platform_fee_records | **denied** | RPC only | **denied** | **denied** |
| audit_logs | members (own tenant) | RPC only | **denied** | **denied** |
| bill_refunds | members | RPC only | **denied** | **denied** |

## Platform admin

`is_platform_admin()` grants read-only SELECT on tenant tables and full read on platform tables.

## Financial writes

Paid/cancelled bill mutations require `billflow.trusted_write = on` inside SECURITY DEFINER RPCs:

- `finalize_bill`
- `create_and_finalize_bill`
- `cancel_bill_with_fee_reversal`
- `record_partial_refund`
- `recalculate_bill_totals` (internal)

## Triggers

- `guard_bill_update` — blocks financial field changes on paid/cancelled bills
- `guard_bill_items_mutation` — blocks item changes on finalized bills
