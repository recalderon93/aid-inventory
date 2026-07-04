import { NextResponse } from "next/server";
import { logAudit } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import type { ImportReviewStatus } from "@/types/database";

async function requireAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return { user, supabase };
}

async function syncProductNeedsReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityId: string | null
) {
  if (!entityId) return;

  const { data: pending } = await supabase
    .from("import_review_items")
    .select("id")
    .eq("entity_id", entityId)
    .eq("entity_type", "donation_item")
    .in("review_status", ["PENDING_REVIEW", "IN_REVIEW"])
    .limit(1);

  await supabase
    .from("donation_items")
    .update({ needs_review: (pending?.length ?? 0) > 0 })
    .eq("id", entityId);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { action, resolution_notes, entity_id } = body as {
    action: "resolve" | "ignore" | "start_review";
    resolution_notes?: string;
    entity_id?: string | null;
  };

  const statusMap: Record<string, ImportReviewStatus> = {
    resolve: "RESOLVED",
    ignore: "IGNORED",
    start_review: "IN_REVIEW",
  };
  const newStatus = statusMap[action];
  if (!newStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    review_status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (entity_id !== undefined) {
    update.entity_id = entity_id;
  }

  if (action === "resolve" || action === "ignore") {
    update.resolved_by = session.user.id;
    update.resolved_at = new Date().toISOString();
    update.resolution_notes = resolution_notes ?? null;
  }

  const { data, error } = await session.supabase
    .from("import_review_items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const linkedEntityId = (data.entity_id as string | null) ?? entity_id ?? null;
  if (linkedEntityId && data.entity_type === "donation_item") {
    await syncProductNeedsReview(session.supabase, linkedEntityId);
  }

  await logAudit(
    `import_review_${action}`,
    "import_review_item",
    id,
    session.user.id,
    { review_status: newStatus, resolution_notes: resolution_notes ?? null }
  );

  return NextResponse.json(data);
}
