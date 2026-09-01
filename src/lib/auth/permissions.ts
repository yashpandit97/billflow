import type { MemberRole } from "@/types/database";

export type Permission =
  | "bill:create"
  | "bill:cancel"
  | "bill:refund"
  | "bill:price_override"
  | "product:manage"
  | "product:view_cost"
  | "customer:manage"
  | "settings:manage"
  | "settings:payment"
  | "settings:whatsapp"
  | "team:manage";

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    "bill:create",
    "bill:cancel",
    "bill:refund",
    "bill:price_override",
    "product:manage",
    "product:view_cost",
    "customer:manage",
    "settings:manage",
    "settings:payment",
    "settings:whatsapp",
    "team:manage",
  ],
  admin: [
    "bill:create",
    "bill:cancel",
    "bill:refund",
    "bill:price_override",
    "product:manage",
    "product:view_cost",
    "customer:manage",
    "settings:payment",
  ],
  staff: ["bill:create", "product:manage", "customer:manage"],
};

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(
  role: MemberRole,
  permission: Permission
): { ok: true } | { ok: false; error: string } {
  if (!hasPermission(role, permission)) {
    return { ok: false, error: "You do not have permission for this action" };
  }
  return { ok: true };
}

export function canPriceOverride(
  role: MemberRole,
  allowCashierOverride: boolean
): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "staff" && allowCashierOverride) return true;
  return false;
}
