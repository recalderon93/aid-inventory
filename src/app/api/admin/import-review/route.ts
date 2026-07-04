import { NextResponse } from "next/server";
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
  return user;
}

export async function GET(request: Request) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const warningCode = searchParams.get("warning_code");
  const actionTaken = searchParams.get("action_taken");
  const entityType = searchParams.get("entity_type");
  const search = searchParams.get("search")?.trim();

  const supabase = await createClient();
  let query = supabase
    .from("import_review_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("review_status", status as ImportReviewStatus);
  }
  if (warningCode) {
    query = query.eq("warning_code", warningCode);
  }
  if (actionTaken) {
    query = query.eq("action_taken", actionTaken);
  }
  if (entityType) {
    query = query.eq("entity_type", entityType);
  }
  if (search) {
    query = query.or(
      `warning_message.ilike.%${search}%,suggested_fix.ilike.%${search}%,original_row_json->>description.ilike.%${search}%,original_row_json->>cleanedDescription.ilike.%${search}%`
    );
  }

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
