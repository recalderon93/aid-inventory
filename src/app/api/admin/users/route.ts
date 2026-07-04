import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auth-helpers";
import type { UserRole, UserStatus } from "@/types/database";

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

export async function GET() {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { email, password, first_name, last_name, phone, role } = body as {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: UserRole;
  };

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `${first_name} ${last_name}`.trim() },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const name = `${first_name} ${last_name}`.trim();
  const { error: profileError } = await admin.from("profiles").upsert({
    id: authData.user.id,
    email,
    name,
    first_name,
    last_name,
    phone: phone ?? null,
    role,
    status: "active" as UserStatus,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await logAudit("user_created", "profile", authData.user.id, user.id, { email, role });

  return NextResponse.json({ id: authData.user.id });
}

export async function PATCH(request: Request) {
  const user = await requireAdminSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, first_name, last_name, phone, role, status, action } = body as {
    id: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: UserRole;
    status?: UserStatus;
    action?: "disable" | "hold" | "reactivate" | "soft_delete";
  };

  const admin = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (phone !== undefined) updates.phone = phone;
  if (role !== undefined) updates.role = role;

  if (action === "disable") {
    updates.status = "disabled";
  } else if (action === "hold") {
    updates.status = "on_hold";
  } else if (action === "reactivate") {
    updates.status = "active";
    updates.deleted_at = null;
  } else if (action === "soft_delete") {
    updates.status = "disabled";
    updates.deleted_at = new Date().toISOString();
  } else if (status !== undefined) {
    updates.status = status;
  }

  if (first_name !== undefined || last_name !== undefined) {
    const { data: existing } = await admin.from("profiles").select("first_name, last_name").eq("id", id).single();
    const fn = first_name ?? existing?.first_name ?? "";
    const ln = last_name ?? existing?.last_name ?? "";
    updates.name = `${fn} ${ln}`.trim();
  }

  const { error } = await admin.from("profiles").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAudit(action ?? "user_updated", "profile", id, user.id, updates);

  return NextResponse.json({ ok: true });
}
