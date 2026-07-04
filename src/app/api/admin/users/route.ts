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
  const name = `${first_name} ${last_name}`.trim();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  // Trigger creates the profile row; update fields the admin chose.
  const baseUpdate = { name, role, status: "active" as UserStatus };
  const extendedUpdate = {
    ...baseUpdate,
    first_name,
    last_name,
    phone: phone ?? null,
  };

  let { error: profileError } = await admin
    .from("profiles")
    .update(extendedUpdate)
    .eq("id", authData.user.id);

  // Migration 00014 adds first_name/last_name/phone — fall back until it is applied.
  if (profileError?.message?.includes("first_name")) {
    ({ error: profileError } = await admin
      .from("profiles")
      .update(baseUpdate)
      .eq("id", authData.user.id));
  }

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
    const { data: existing } = await admin.from("profiles").select("name").eq("id", id).single();
    const fn = first_name ?? "";
    const ln = last_name ?? "";
    const combined = `${fn} ${ln}`.trim();
    if (combined) updates.name = combined;
    else if (existing?.name) updates.name = existing.name;
  }

  let { error } = await admin.from("profiles").update(updates).eq("id", id);
  if (error?.message?.includes("first_name")) {
    delete updates.first_name;
    delete updates.last_name;
    delete updates.phone;
    ({ error } = await admin.from("profiles").update(updates).eq("id", id));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAudit(action ?? "user_updated", "profile", id, user.id, updates);

  return NextResponse.json({ ok: true });
}
