import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false as const, error: new Error("No active session") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      ok: false as const,
      error: new Error("Profile not found — contact administrator"),
    };
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return {
      ok: false as const,
      error: new Error("Account is not active"),
    };
  }

  return { ok: true as const };
}
