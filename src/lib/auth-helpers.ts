import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return profile;
}

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  actorId: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor_id: actorId,
    metadata,
  });
}

export async function logOrderChange(
  orderId: string,
  changedBy: string,
  field: string,
  oldValue: string | null,
  newValue: string | null
) {
  const supabase = await createClient();
  await supabase.from("order_history").insert({
    order_id: orderId,
    changed_by: changedBy,
    field,
    old_value: oldValue,
    new_value: newValue,
  });
}

export type { UserRole };
