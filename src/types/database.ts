export type MemberRole = "owner" | "admin" | "staff";
export type BillStatus = "draft" | "paid" | "cancelled";
export type PaymentStatus = "pending" | "paid";
export type PaymentMethod =
  | "cash"
  | "card"
  | "upi"
  | "bank_transfer"
  | "other";
export type PaymentQrMode = "uploaded" | "dynamic";
export type FeeRecordType = "fee" | "reversal" | "refund_adjustment";
export type InvoiceStyle = "a4" | "thermal";
export type WhatsAppDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed";
export type WhatsAppProvider = "cloud_api" | "wa_me_deeplink" | "manual";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "none";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  active_business_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  currency: string;
  locale: string;
  invoice_prefix: string;
  invoice_starting_number: number;
  default_tax_rate_bps: number;
  tax_enabled: boolean;
  invoice_footer: string | null;
  payment_instructions: string | null;
  primary_color: string;
  secondary_color: string;
  invoice_style: InvoiceStyle;
  open_tabs_enabled: boolean;
  allow_cashier_price_override: boolean;
  plan: string;
  subscription_status: SubscriptionStatus;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiningTable {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  description: string | null;
  selling_price: number;
  cost_price: number | null;
  unit: string;
  tax_rate_bps: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category | null;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  tenant_id: string;
  invoice_number: string | null;
  customer_id: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: BillStatus;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  notes: string | null;
  tab_label: string | null;
  table_id: string | null;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  finalized_at: string | null;
  refunded_total: number;
  created_at: string;
  updated_at: string;
  customers?: Customer | null;
  bill_items?: BillItem[];
  dining_tables?: DiningTable | null;
}

export interface BillItem {
  id: string;
  tenant_id: string;
  bill_id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  catalog_unit_price: number | null;
  price_override: boolean;
  override_reason: string | null;
  overridden_by: string | null;
  tax_rate_bps: number;
  discount: number;
  line_total: number;
  created_at: string;
}

export interface InvoiceSequence {
  tenant_id: string;
  current_value: number;
  updated_at: string;
}

export interface PaymentSettings {
  business_id: string;
  upi_enabled: boolean;
  upi_id: string | null;
  upi_qr_code_url: string | null;
  payment_qr_mode: PaymentQrMode;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  id: number;
  fee_percentage_bps: number;
  updated_at: string;
}

export interface PlatformFeeRecord {
  id: string;
  tenant_id: string;
  bill_id: string;
  bill_amount: number;
  fee_percentage_bps: number;
  fee_amount: number;
  currency: string;
  record_type: FeeRecordType;
  reverses_record_id: string | null;
  created_at: string;
  created_by: string | null;
}

/** @deprecated Platform transaction fees removed; subscription billing model. */
export type DeprecatedPlatformFeeRecord = PlatformFeeRecord;

export type ReferralStatus = "pending" | "qualified" | "rewarded" | "rejected";

export interface TenantSubscriptionRow {
  id: string;
  tenant_id: string;
  status: SubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_tenant_id: string;
  referred_tenant_id: string;
  referral_code: string;
  status: ReferralStatus;
  reward_months: number;
  created_at: string;
  qualified_at: string | null;
  rewarded_at: string | null;
}

export interface SubscriptionCredit {
  id: string;
  tenant_id: string;
  credit_type: string;
  months: number;
  source: string;
  referral_id: string | null;
  created_at: string;
  used_at: string | null;
}

/** Public-safe WhatsApp settings (never includes access token). */
export interface WhatsAppSettingsPublic {
  business_id: string;
  whatsapp_enabled: boolean;
  whatsapp_business_account_id: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_message_template: string | null;
  has_access_token: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppInvoiceDelivery {
  id: string;
  tenant_id: string;
  bill_id: string;
  customer_id: string | null;
  phone_number: string;
  provider: WhatsAppProvider;
  status: WhatsAppDeliveryStatus;
  provider_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}
