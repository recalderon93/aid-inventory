import { createClient } from "@/lib/supabase/client";
import type { PageResult } from "@/hooks/use-infinite-refreshable-list";
import type { Order, OrderItemStatus } from "@/types/database";
import { countOrderProgress } from "@/lib/order-fulfillment";

export const ORDERS_PAGE_SIZE = 20;

// Do not embed relations here — PostgREST rejects count: "exact" with nested selects.
const ORDER_SELECT =
  "*, created_by:profiles!orders_created_by_user_id_fkey(name), prepared_by:profiles!orders_prepared_by_user_id_fkey(name), completed_by:profiles!orders_completed_by_user_id_fkey(name)";

export type OrderWithHandler = Order & {
  created_by?: { name: string } | null;
  prepared_by?: { name: string } | null;
  completed_by?: { name: string } | null;
  progressLabel?: string;
};

async function attachProgressLabels(orders: OrderWithHandler[]): Promise<OrderWithHandler[]> {
  if (orders.length === 0) return orders;

  const supabase = createClient();
  const orderIds = orders.map((o) => o.id);
  const { data: items, error } = await supabase
    .from("order_items")
    .select("order_id, status")
    .in("order_id", orderIds);

  if (error) {
    console.error("attachProgressLabels", error.message);
    return orders;
  }

  const itemsByOrder = new Map<string, OrderItemStatus[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item.status);
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((order) => {
    const statuses = itemsByOrder.get(order.id) ?? [];
    const progress = countOrderProgress(
      statuses.map((status, index) => ({
        id: String(index),
        requested_quantity: 1,
        fulfilled_quantity: 0,
        status,
      }))
    );
    return { ...order, progressLabel: progress.label };
  });
}

async function fetchOrdersByStatus(
  status: Order["status"] | Order["status"][],
  page: number,
  orderColumn: "created_at" | "completed_at" = "created_at"
): Promise<PageResult<OrderWithHandler>> {
  const supabase = createClient();
  const from = page * ORDERS_PAGE_SIZE;
  const to = from + ORDERS_PAGE_SIZE - 1;

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .order(orderColumn, { ascending: false })
    .range(from, to);

  if (Array.isArray(status)) {
    query = query.in("status", status);
  } else {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("fetchOrdersByStatus", error.message);
    return { items: [], hasMore: false };
  }

  const total = count ?? 0;
  const items = await attachProgressLabels((data as OrderWithHandler[]) ?? []);

  return {
    items,
    hasMore: to + 1 < total,
  };
}

export async function fetchPendingOrdersPage(page: number): Promise<PageResult<OrderWithHandler>> {
  return fetchOrdersByStatus("pending", page);
}

export async function fetchInProgressOrdersPage(page: number): Promise<PageResult<OrderWithHandler>> {
  return fetchOrdersByStatus("in_progress", page);
}

export async function fetchCompletedOrdersPage(page: number): Promise<PageResult<OrderWithHandler>> {
  return fetchOrdersByStatus("completed", page, "completed_at");
}
