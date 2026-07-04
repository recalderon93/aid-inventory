import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileCheckFailure =
  | "no_profile"
  | "inactive"
  | "query_error";

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup failed:", error.message);
    await supabase.auth.signOut();
    return {
      ok: false as const,
      reason: "query_error" as const,
      error,
    };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      ok: false as const,
      reason: "no_profile" as const,
      error: new Error("Profile not found"),
    };
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return {
      ok: false as const,
      reason: "inactive" as const,
      error: new Error("Account is not active"),
    };
  }

  return { ok: true as const };
}
