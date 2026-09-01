# Billflow

Multi-tenant billing SaaS for small businesses. One deployment, many tenants, strong RLS isolation.

**Business model:** **₹299/month per business** (one subscription covers all staff). **30-day free trial** on signup. Referrals earn **1 free month** when the referred business becomes a paying customer. No transaction-based platform fees on customer invoices.

## Tech stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui (Midnight Gold dark theme)
- Supabase (Auth, Postgres, Storage, RLS)
- Zod validation · integer money math · Recharts (admin)

## Architecture

```
Platform (Billflow)
  ├── Platform admins → /admin (subscriptions, referrals, businesses, users)
  └── Tenants / Businesses
        ├── Members (owner | admin | staff) — no per-seat billing
        ├── Products, customers, bills
        ├── Subscription (₹299/mo) + Refer & Earn
        ├── Payment settings (UPI QR upload)
        └── Reports (tenant-scoped only)
```

### Subscription billing

- **₹299/month** per business tenant (integer paise in DB: `29900`)
- **30-day free trial** starts when the business is created
- One subscription covers owner + all staff users
- `tenant_subscriptions`, `subscription_credits`, modular payment stub (`markSubscriptionPaidAction` for MVP)
- Referrals: unique `referral_code` per business; reward = 1 free month credit when referred tenant pays

### Invoice sharing (mobile-first)

- **Share Invoice** uses native Web Share API (PDF + pre-written message) where supported
- Fallback: download PDF, copy message, open WhatsApp Web
- No WhatsApp Business API required for MVP — owner taps Send in WhatsApp manually
- Customer invoices never show SaaS subscription fees

### UPI QR

- Settings → Payment: enable UPI, set UPI ID, **upload owner QR** (Storage `upi-qr`)
- Invoices show QR only when `payment_method = upi` and a QR is configured
- `payment_status` (`pending` | `paid`) is separate from payment method — UPI does not auto-confirm payment
- `payment_qr_mode` supports future `dynamic` URI QR; MVP is `uploaded`

### Restaurant / open tabs + guest QR menu

- Settings → Invoice: enable **Restaurant / open tabs mode**
- Settings → Tables: create dining tables; each gets a unique QR → `/m/{slug}/t/{token}`
- Guests scan QR (no login), browse the menu, send orders to that table’s open draft bill
- Billing POS shows a tab strip; guest items appear live (Realtime); staff Completes to finalize invoice
- Walk-in / takeaway tabs (no table) are supported alongside table tabs

### WhatsApp invoice delivery

- **Primary (MVP):** Share Invoice → native share sheet → WhatsApp with PDF + message
- Optional Cloud API settings remain for future automated delivery
- Invoice creation never depends on WhatsApp success

### Multi-tenancy / RLS

- Every tenant row has `tenant_id` / membership checks via `user_business_ids()`
- `platform_fee_records` is deprecated (fees disabled); kept for historical data only
- `/admin` requires a `platform_admins` row (server + middleware)

## Local setup

```bash
npm install
cp .env.example .env.local
npx supabase start
npx supabase status   # copy URL + anon + service role into .env.local
npx supabase db reset # migrations + seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Promote a platform admin

After signup (or after seed, which promotes the first auth user):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'your@email.com'
on conflict do nothing;
```

Then visit `/admin`.

### Hosted Supabase

1. Create a project and set env vars
2. Run both migrations in `supabase/migrations/`
3. Create storage buckets `logos` and `upi-qr` (or run migration policies)
4. Set Auth redirect URLs to `{SITE_URL}/auth/callback`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (billing + fee math) |

## Theme

Forced **Midnight Gold** dark UI (`html.dark`): charcoal surfaces, gold accent `#D4AF37`. Tenant brand colors apply to **invoices only**.

## Migrations

1. `20260331000000_init.sql` — core tenancy, bills, RLS
2. `20260901000000_platform_upi_fees.sql` — payment_settings, platform fees/admins, payment_status, UPI storage

## Security checklist

- No service role in the browser
- Fee % and fee amounts never trusted from the client
- Platform fee is 1% of finalized bill volume (no subscription tiers)
- Tenant cannot select `platform_fee_records`
- Non-admins redirected away from `/admin`
- Storage paths scoped by `{tenant_id}/…`

## Known limitations

- Dynamic UPI amount QR not primary (schema ready)
- WhatsApp invoice delivery (Cloud API + Open WhatsApp fallback)
- No payment gateway required for tenant checkout
- Seed promotes first auth user to platform admin (local convenience)

## Recommended next features

- Payment provider webhooks for UPI confirmation
- Dynamic UPI intent QR with amount + invoice ref
- Staff invite emails
- Export revenue CSV for platform ops
# billflow
