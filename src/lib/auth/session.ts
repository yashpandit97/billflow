import { createClient } from "@/lib/supabase/server";
import type { Business, BusinessMember, Profile, MemberRole } from "@/types/database";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function getActiveMembership() {
  const { supabase, user } = await requireUser();

  const { data: membership } = await supabase
    .from("business_members")
    .select("*, businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const business = membership.businesses as unknown as Business;

  return {
    supabase,
    user,
    membership: membership as BusinessMember & { businesses: Business },
    business,
    tenantId: membership.business_id as string,
    role: membership.role as MemberRole,
  };
}

export async function getProfile(): Promise<Profile | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}
