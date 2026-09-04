-- Platform WhatsApp Cloud API credentials (single sender for all tenants)
alter table public.platform_whatsapp_settings
  add column if not exists whatsapp_business_account_id text,
  add column if not exists whatsapp_phone_number_id text,
  add column if not exists whatsapp_access_token text,
  add column if not exists display_phone_number text;

comment on table public.platform_whatsapp_settings is
  'BillMoney platform WhatsApp Business account — all tenant invoice messages are sent from this number.';
