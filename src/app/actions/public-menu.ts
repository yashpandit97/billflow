"use server";

import { createClient } from "@/lib/supabase/server";
import { guestOrderSchema } from "@/lib/validation/schemas";

export type PublicMenuResult = {
  error?: string;
  data?: {
    business: {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      currency: string;
      locale: string;
      primary_color: string;
      tax_enabled: boolean;
    };
    table: { id: string; name: string };
    products: Array<{
      id: string;
      name: string;
      description: string | null;
      selling_price: number;
      unit: string;
      category_id: string | null;
    }>;
  };
};

export type GuestOrderResult = {
  error?: string;
  data?: {
    bill_id: string;
    tab_label: string | null;
    table_name: string;
    subtotal: number;
    tax: number;
    total: number;
    item_count: number;
  };
};

export async function getPublicMenuAction(
  slug: string,
  token: string
): Promise<PublicMenuResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_menu", {
    p_slug: slug,
    p_token: token,
  });

  if (error) return { error: error.message };
  return { data: data as PublicMenuResult["data"] };
}

export async function appendGuestOrderAction(input: {
  slug: string;
  token: string;
  items: Array<{ product_id: string; quantity: number }>;
}): Promise<GuestOrderResult> {
  const parsed = guestOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("append_guest_order", {
    p_slug: parsed.data.slug,
    p_token: parsed.data.token,
    p_items: parsed.data.items,
  });

  if (error) return { error: error.message };
  return { data: data as GuestOrderResult["data"] };
}
