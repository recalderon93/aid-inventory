import { createClient } from "@/lib/supabase/client";
import { filterSlots, sortSlotsByNumber } from "@/lib/slot-search";
import type { Slot } from "@/types/database";
import type { PageResult } from "@/hooks/use-infinite-refreshable-list";

export const SLOTS_PAGE_SIZE = 36;

let slotsMetaCache: { id: string; number: string }[] | null = null;

export function clearSlotsListCache() {
  slotsMetaCache = null;
}

async function loadSlotsMeta() {
  if (slotsMetaCache) return slotsMetaCache;
  const supabase = createClient();
  const { data } = await supabase.from("slots").select("id, number").is("deleted_at", null);
  slotsMetaCache = sortSlotsByNumber(data ?? []);
  return slotsMetaCache;
}

export async function fetchAllSlotNumbers(): Promise<string[]> {
  const meta = await loadSlotsMeta();
  return meta.map((s) => s.number);
}

export async function fetchSlotOptions(): Promise<{ id: string; number: string }[]> {
  return loadSlotsMeta();
}

export async function fetchSlotsPage(
  page: number,
  search: string
): Promise<PageResult<Slot>> {
  const meta = await loadSlotsMeta();
  const filtered = search.trim() ? filterSlots(meta, search) : meta;
  const start = page * SLOTS_PAGE_SIZE;
  const slice = filtered.slice(start, start + SLOTS_PAGE_SIZE);

  if (slice.length === 0) {
    return { items: [], hasMore: false };
  }

  const supabase = createClient();
  const { data } = await supabase.from("slots").select("*").in(
    "id",
    slice.map((s) => s.id)
  );

  const byId = new Map((data ?? []).map((slot) => [slot.id, slot as Slot]));
  const items = slice.map((s) => byId.get(s.id)).filter((s): s is Slot => !!s);

  return {
    items,
    hasMore: start + SLOTS_PAGE_SIZE < filtered.length,
  };
}
