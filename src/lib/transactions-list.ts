import { createClient } from "@/lib/supabase/client";
import type { PageResult } from "@/hooks/use-infinite-refreshable-list";
import type { InventoryTransaction, InventoryTransactionType } from "@/types/database";

export const TRANSACTIONS_PAGE_SIZE = 40;

export const TRANSACTION_TYPE_OPTIONS: InventoryTransactionType[] = [
  "inbound",
  "outbound",
  "order_fulfillment",
  "merma",
  "adjustment",
  "relocation",
  "slot_deactivation",
  "slot_shipment",
];

export type TransactionFilters = {
  type: string;
  productSearch: string;
  slotId: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  type: "",
  productSearch: "",
  slotId: "",
  dateFrom: "",
  dateTo: "",
};

const TRANSACTION_SELECT =
  "*, donation_item:donation_items(description), from_slot:slots!inventory_transactions_from_slot_id_fkey(number), to_slot:slots!inventory_transactions_to_slot_id_fkey(number), created_by:profiles!inventory_transactions_created_by_user_id_fkey(name), order:orders(order_number)";

export type TransactionListItem = Omit<InventoryTransaction, "donation_item"> & {
  donation_item?: { description: string } | null;
  from_slot?: { number: string } | null;
  to_slot?: { number: string } | null;
  created_by?: { name: string } | null;
  order?: { order_number: string } | null;
};

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

type QueryLike = {
  eq: (column: string, value: string) => QueryLike;
  gte: (column: string, value: string) => QueryLike;
  lte: (column: string, value: string) => QueryLike;
  or: (filters: string) => QueryLike;
  filter: (column: string, operator: string, value: string) => QueryLike;
};

export function applyTransactionQueryFilters<T extends QueryLike>(query: T, filters: TransactionFilters): T {
  let next = query;

  if (filters.type) {
    next = next.eq("type", filters.type) as T;
  }

  const productSearch = filters.productSearch.trim();
  if (productSearch) {
    const pattern = `%${escapeIlike(productSearch)}%`;
    next = next.filter("donation_items.description", "ilike", pattern) as T;
  }

  if (filters.slotId) {
    next = next.or(`from_slot_id.eq.${filters.slotId},to_slot_id.eq.${filters.slotId}`) as T;
  }

  if (filters.dateFrom) {
    next = next.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`) as T;
  }

  if (filters.dateTo) {
    next = next.lte("created_at", `${filters.dateTo}T23:59:59.999Z`) as T;
  }

  return next;
}

export function filterTransactions(
  items: TransactionListItem[],
  filters: TransactionFilters
): TransactionListItem[] {
  return items.filter((tx) => {
    if (filters.type && tx.type !== filters.type) return false;

    const productSearch = filters.productSearch.trim().toLowerCase();
    if (productSearch) {
      const description = tx.donation_item?.description?.toLowerCase() ?? "";
      if (!description.includes(productSearch)) return false;
    }

    if (filters.slotId) {
      const matchesSlot =
        tx.from_slot_id === filters.slotId || tx.to_slot_id === filters.slotId;
      if (!matchesSlot) return false;
    }

    if (filters.dateFrom) {
      const from = new Date(`${filters.dateFrom}T00:00:00.000Z`).getTime();
      if (new Date(tx.created_at).getTime() < from) return false;
    }

    if (filters.dateTo) {
      const to = new Date(`${filters.dateTo}T23:59:59.999Z`).getTime();
      if (new Date(tx.created_at).getTime() > to) return false;
    }

    return true;
  });
}

export function transactionTypeBadgeClass(type: InventoryTransactionType): string {
  switch (type) {
    case "inbound":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "outbound":
    case "order_fulfillment":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "merma":
      return "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200";
    case "adjustment":
      return "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";
    default:
      return "bg-surface-2 text-foreground";
  }
}

export async function fetchTransactionsPage(
  page: number,
  filters: TransactionFilters = EMPTY_TRANSACTION_FILTERS
): Promise<PageResult<TransactionListItem>> {
  const supabase = createClient();
  const from = page * TRANSACTIONS_PAGE_SIZE;
  const to = from + TRANSACTIONS_PAGE_SIZE - 1;

  let query = supabase
    .from("inventory_transactions")
    .select(TRANSACTION_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  query = applyTransactionQueryFilters(query, filters);

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("fetchTransactionsPage", error.message);
    return { items: [], hasMore: false };
  }

  const total = count ?? 0;
  return {
    items: (data as TransactionListItem[]) ?? [],
    hasMore: to + 1 < total,
  };
}
