import { createClient } from "@/lib/supabase/client";
import type { PageResult } from "@/hooks/use-infinite-refreshable-list";
import type { DonationItemStatus } from "@/types/database";

export const INVENTORY_PAGE_SIZE = 30;

export interface InventoryListItem {
  donation_item_id: string;
  description: string;
  category: string;
  subcategory: string | null;
  presentation: string | null;
  unit_of_measurement: string | null;
  status: DonationItemStatus;
  total_quantity: number;
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

type DonationItemRow = {
  id: string;
  category: string;
  subcategory: string | null;
  description: string;
  presentation: string | null;
  unit_of_measurement: string | null;
  status: DonationItemStatus;
  inventory: { quantity: number }[];
};

function mapRow(row: DonationItemRow): InventoryListItem {
  const total_quantity = (row.inventory ?? []).reduce((sum, inv) => sum + inv.quantity, 0);
  return {
    donation_item_id: row.id,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    presentation: row.presentation,
    unit_of_measurement: row.unit_of_measurement,
    status: row.status,
    total_quantity,
  };
}

export async function fetchInventoryCategories(): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("donation_items")
    .select("subcategory")
    .is("deleted_at", null)
    .not("subcategory", "is", null);

  return [...new Set((data ?? []).map((r) => r.subcategory).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "es")
  );
}

export async function fetchInventoryPage(
  page: number,
  filters: { search: string; category: string }
): Promise<PageResult<InventoryListItem>> {
  const supabase = createClient();
  const from = page * INVENTORY_PAGE_SIZE;
  const to = from + INVENTORY_PAGE_SIZE - 1;

  let query = supabase
    .from("donation_items")
    .select("id, category, subcategory, description, presentation, unit_of_measurement, status, inventory!inner(quantity)", {
      count: "exact",
    })
    .is("deleted_at", null);

  if (filters.category) {
    query = query.eq("subcategory", filters.category);
  }

  const search = filters.search.trim();
  if (search) {
    const pattern = `%${escapeIlike(search)}%`;
    query = query.or(
      `description.ilike.${pattern},subcategory.ilike.${pattern},presentation.ilike.${pattern}`
    );
  }

  const { data, count, error } = await query.order("description").range(from, to);

  if (error) {
    console.error("fetchInventoryPage", error.message);
    return { items: [], hasMore: false };
  }

  const items = (data as DonationItemRow[])
    .map(mapRow)
    .filter((item) => item.total_quantity > 0);

  const total = count ?? 0;
  return {
    items,
    hasMore: to + 1 < total,
  };
}
