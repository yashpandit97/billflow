import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z
  .object({
    fullName: z.string().min(1, "Name is required").max(120),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const businessSetupSchema = z.object({
  name: z.string().min(1, "Business name is required").max(160),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  taxId: z.string().max(40).optional().or(z.literal("")),
  currency: z.string().min(3).max(3).default("INR"),
  invoicePrefix: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Prefix may contain letters, numbers, and hyphens")
    .default("INV"),
  invoiceStartingNumber: z.coerce.number().int().min(1).default(1),
  defaultTaxRatePercent: z.coerce.number().min(0).max(100).default(0),
  taxEnabled: z.boolean().default(true),
});

export const businessProfileSchema = z.object({
  name: z.string().min(1, "Business name is required").max(160),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address: z.string().max(500).optional().nullable(),
  website: z.string().url().optional().or(z.literal("")).nullable(),
  tax_id: z.string().max(40).optional().nullable(),
  invoice_footer: z.string().max(1000).optional().nullable(),
  payment_instructions: z.string().max(1000).optional().nullable(),
});

export const brandingSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color"),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color"),
  invoice_style: z.enum(["a4", "thermal"]),
});

export const invoiceSettingsSchema = z.object({
  invoice_prefix: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/),
  invoice_starting_number: z.coerce.number().int().min(1),
  open_tabs_enabled: z.boolean().default(false),
});

export const diningTableSchema = z.object({
  name: z.string().min(1, "Table name is required").max(80),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const createOpenTabSchema = z
  .object({
    tab_label: z.string().max(80).optional().nullable(),
    table_id: z.string().uuid().optional().nullable(),
    customer_id: z.string().uuid().optional().nullable(),
  })
  .refine((d) => Boolean(d.table_id) || Boolean(d.tab_label?.trim()), {
    message: "Provide a table or tab label",
  });

export const guestOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

export const guestOrderSchema = z.object({
  slug: z.string().min(1),
  token: z.string().min(16),
  items: z.array(guestOrderItemSchema).min(1).max(50),
});

export const taxSettingsSchema = z.object({
  tax_enabled: z.boolean(),
  default_tax_rate_percent: z.coerce.number().min(0).max(100),
  currency: z.string().min(3).max(3),
});

export const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  sku: z.string().max(60).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  category_id: z.string().uuid().optional().nullable().or(z.literal("")),
  selling_price: z.coerce.number().min(0, "Price must be ≥ 0"),
  cost_price: z.coerce.number().min(0).optional().nullable().or(z.literal("")),
  unit: z.string().min(1).max(40).default("pcs"),
  tax_rate_percent: z.coerce.number().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  phone: z
    .string()
    .max(40)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => {
        if (!v) return true;
        // Light format check; full E.164 validation happens at send time
        return /^[+]?[\d\s()-]{8,20}$/.test(v);
      },
      { message: "Enter a valid phone number (e.g. +91XXXXXXXXXX)" }
    ),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  tax_id: z.string().max(40).optional().or(z.literal("")),
});

export const whatsappSettingsSchema = z.object({
  whatsapp_enabled: z.boolean(),
  whatsapp_business_account_id: z.string().max(120).optional().or(z.literal("")),
  whatsapp_phone_number_id: z.string().max(120).optional().or(z.literal("")),
  whatsapp_access_token: z.string().max(2000).optional().or(z.literal("")),
  whatsapp_message_template: z.string().max(120).optional().or(z.literal("")),
});

export const platformWhatsAppSettingsSchema = z.object({
  enabled: z.boolean(),
  meta_app_id: z.string().max(120).optional().or(z.literal("")),
  whatsapp_business_account_id: z.string().max(120).optional().or(z.literal("")),
  whatsapp_phone_number_id: z.string().max(120).optional().or(z.literal("")),
  whatsapp_access_token: z.string().max(2000).optional().or(z.literal("")),
  display_phone_number: z.string().max(40).optional().or(z.literal("")),
  default_template_name: z.string().max(120).optional().or(z.literal("")),
});

export const billItemInputSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  line_discount: z.coerce.number().min(0).default(0),
  unit_price_override: z.coerce.number().min(0).optional(),
  override_reason: z.string().max(500).optional(),
});

export const updateDraftBillSchema = z.object({
  bill_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  bill_discount: z.coerce.number().min(0).default(0),
  payment_method: z
    .enum(["cash", "card", "upi", "bank_transfer", "other"])
    .optional()
    .nullable(),
  payment_status: z.enum(["pending", "paid"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(billItemInputSchema),
});

export const finalizeDraftBillSchema = z.object({
  bill_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  bill_discount: z.coerce.number().min(0).default(0),
  payment_method: z
    .enum(["cash", "card", "upi", "bank_transfer", "other"])
    .optional()
    .nullable(),
  payment_status: z.enum(["pending", "paid"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(billItemInputSchema).min(1, "Add at least one item"),
  idempotency_key: z.string().uuid().optional(),
});

export const createBillSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  bill_discount: z.coerce.number().min(0).default(0),
  payment_method: z
    .enum(["cash", "card", "upi", "bank_transfer", "other"])
    .optional()
    .nullable(),
  payment_status: z.enum(["pending", "paid"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(billItemInputSchema).min(1, "Add at least one item"),
  idempotency_key: z.string().uuid().optional(),
});

export const partialRefundSchema = z.object({
  bill_id: z.string().uuid(),
  amount: z.coerce.number().positive("Refund amount must be > 0"),
  reason: z.string().min(1, "Reason is required").max(500),
});

export const paymentSettingsSchema = z.object({
  upi_enabled: z.boolean(),
  upi_id: z.string().max(120).optional().or(z.literal("")),
  payment_qr_mode: z.enum(["uploaded", "dynamic"]).default("uploaded"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type BusinessSetupInput = z.infer<typeof businessSetupSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;
