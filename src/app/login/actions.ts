"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProfileCheckFailure } from "@/lib/ensure-profile";

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: ProfileCheckFailure | "auth_error"; message?: string };

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const supabase = await createClient();

  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { ok: false, reason: "auth_error", message: authError.message };
  }

  if (!data.user) {
    return { ok: false, reason: "auth_error", message: "No user returned" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile lookup failed:", profileError.message);
    await supabase.auth.signOut();
    return { ok: false, reason: "query_error" };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, reason: "no_profile" };
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return { ok: false, reason: "inactive" };
  }

  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return { ok: true };
}
