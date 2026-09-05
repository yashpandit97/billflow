# BillMoney

Multi-tenant billing SaaS for small businesses. One deployment, many tenants, strong RLS isolation.

**Business model:** **₹999/month per business** (one subscription covers all staff). Configurable free trial on signup (set in Admin → Settings; marketing promises 30 days). Referrals earn **1 free month** when the referred business becomes a paying customer. No transaction-based platform fees on customer invoices.

## Tech stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui (Midnight Gold dark theme)
- Supabase (Auth, Postgres, Storage, RLS)
- Zod validation · integer money math · Recharts (admin)

## Architecture

```
Platform (BillMoney)
  ├── Platform admins → /admin (subscriptions, referrals, businesses, users)
  └── Tenants / Businesses
        ├── Members (owner | admin | staff) — no per-seat billing
        ├── Products, customers, bills
        ├── Subscription (₹999/mo) + Refer & Earn
        ├── Payment settings (UPI QR upload)
        └── Reports (tenant-scoped only)
```

### Subscription billing

- **₹999/month** per business tenant (integer paise in DB: `99900`)
- Free trial length is configured in **Admin → Settings** (`platform_settings`); default for testing is 5 minutes, production target 30 days
- One subscription covers owner + all staff users
- Platform owner records payments or grants complimentary access under **Admin → Subscriptions**
- Referrals: unique `referral_code` per business; reward = 1 free month credit when referred tenant pays

### Invoice sharing (mobile-first)

- After creating a bill, **Send on WhatsApp** shares the PDF + message
- Fallback: download PDF, copy message, open WhatsApp Web
- Customer invoices never show SaaS subscription fees
- PDF is generated with pdf-lib (Workers-safe) from the same invoice data as on-screen preview

### UPI QR

- Settings → Payment: enable UPI, set UPI ID, **upload owner QR** (PNG/JPG; Storage `upi-qr`)
- Invoices show QR only when `payment_method = upi` and a QR is configured
- `payment_status` (`pending` | `paid`) is separate from payment method — UPI does not auto-confirm payment

### Restaurant / open tabs + guest QR menu

- Settings → Invoice: enable **Cafe / restaurant mode**
- Tables & QR menus appear under Invoice when mode is on; each table QR → `/m/{slug}/t/{token}`
- Guests scan QR (no login), browse the menu, send orders to that table’s open draft bill
- Billing POS shows a tab strip; guest items appear live (Realtime); staff Completes to finalize invoice

### WhatsApp invoice delivery

- **Primary:** Send on WhatsApp from a bill (Cloud API when configured, else open WhatsApp)
- **Cloud API:** All tenant invoices are sent from **BillMoney’s** WhatsApp Business number (Admin → WhatsApp, or Worker env)
- **Webhook:** Meta Callback URL `{SITE_URL}/api/whatsapp/webhook`
- Invoice creation never depends on WhatsApp success

### Multi-tenancy / RLS

- Every tenant row has `tenant_id` / membership checks via `user_business_ids()`
- `platform_fee_records` is deprecated (fees disabled); kept for historical data only
- `/admin` uses a hardcoded owner login cookie (see below) — not a Supabase user row

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

### Owner admin login

Owner admin uses a **hardcoded login** at `/admin/login`:

- Username: `admin`
- Password: `billmoney-admin`

This is independent of Supabase Auth. Change credentials in `src/lib/admin/credentials.ts` when ready. Set trial duration under **Admin → Settings**. Record tenant payments under **Admin → Subscriptions**.

### Hosted Supabase

1. Create a project and set env vars (see Cloudflare section below)
2. Run both migrations in `supabase/migrations/`
3. Create storage buckets `logos` and `upi-qr` (or run migration policies)
4. Set Auth redirect URLs to `{SITE_URL}/auth/callback`

### Cloudflare Workers (required for production)

`NEXT_PUBLIC_*` is baked into the client at **build** time. If those were missing during the Cloudflare build, they stay empty forever — setting only runtime vars does not fix the browser.

Do this:

1. **Workers → billflow → Settings → Variables and Secrets** (runtime — auth/server):

| Name | Example |
|------|---------|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (encrypt) |
| `SITE_URL` | `https://billflow.yashpandit343.workers.dev` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Same random string as Meta Verify token |
| `WHATSAPP_APP_SECRET` | Meta App Secret (optional HMAC for POST) |
| `WHATSAPP_PHONE_NUMBER_ID` | Platform sender phone number ID (optional env override) |
| `WHATSAPP_ACCESS_TOKEN` | Platform sender access token (optional env override) |

2. **Workers → billflow → Settings → Build → Build variables and secrets** (so the client bundle gets real values):

| Name | Same value as |
|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` |
| `NEXT_PUBLIC_SITE_URL` | `SITE_URL` |

> Cloudflare Worker script name is still **`billflow`** (CI-connected). Product branding is BillMoney. Keep `wrangler.jsonc` `name` / `WORKER_SELF_REFERENCE` as `billflow` until you rename the Worker in the Cloudflare dashboard.

3. Trigger a **new deploy** after saving.

`npm run deploy` uses `--keep-vars` so dashboard runtime vars are not wiped.

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
- Tenant cannot select `platform_fee_records`
- Owner admin gated by signed cookie; non-owners redirected from `/admin`
- Storage paths scoped by `{tenant_id}/…`
- Expired trials blocked from POS / mutating actions

## Known limitations

- No payment gateway for the ₹999 SaaS fee (owner records payment in admin)
- Dynamic UPI amount QR not primary
- Staff invite emails not built yet
