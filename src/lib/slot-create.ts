import type { SupabaseClient } from "@supabase/supabase-js";
import type { Slot } from "@/types/database";

export async function createSlot(
  supabase: SupabaseClient,
  number: string
): Promise<{ slot: Slot | null; error: string | null }> {
  const trimmed = number.trim();
  if (!trimmed) return { slot: null, error: "empty" };

  const { data, error } = await supabase
    .from("slots")
    .insert({ number: trimmed, name: trimmed, status: "active" })
    .select()
    .single();

  if (error || !data) {
    return { slot: null, error: error?.message ?? "unknown" };
  }

  return { slot: data, error: null };
}
