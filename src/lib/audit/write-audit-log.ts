import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAuditLog(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.rpc("write_audit_log", {
    p_tenant_id: opts.tenantId,
    p_action: opts.action,
    p_entity_type: opts.entityType,
    p_entity_id: opts.entityId ?? null,
    p_metadata: opts.metadata ?? {},
  });
}
