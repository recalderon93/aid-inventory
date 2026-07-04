import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem, InventoryTransaction } from "@/types/database";
import type { PickInput } from "@/lib/order-fulfillment";

function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.message?.includes("Could not find the function") ||
    error.message?.includes("function") && error.message?.includes("does not exist")
  );
}

export async function startOrder(orderId: string) {
  const supabase = createClient();
  const rpc = await supabase.rpc("start_order", { p_order_id: orderId }).single<Order>();
  if (!rpc.error) return rpc;

  if (!isMissingRpc(rpc.error)) return rpc;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return supabase
    .from("orders")
    .update({
      status: "in_progress",
      prepared_by_user_id: user?.id ?? null,
      prepared_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select()
    .single();
}

export async function confirmOrderItemPicks(orderItemId: string, picks: PickInput[]) {
  const supabase = createClient();
  return supabase
    .rpc("confirm_order_item_picks", {
      p_order_item_id: orderItemId,
      p_picks: picks,
    })
    .single<OrderItem>();
}

export async function recordMerma(params: {
  slotId: string;
  donationItemId: string;
  quantity: number;
  reason: string;
  notes?: string;
  orderId?: string;
  orderItemId?: string;
}) {
  const supabase = createClient();
  return supabase
    .rpc("record_merma", {
      p_slot_id: params.slotId,
      p_donation_item_id: params.donationItemId,
      p_quantity: params.quantity,
      p_reason: params.reason,
      p_notes: params.notes ?? null,
      p_order_id: params.orderId ?? null,
      p_order_item_id: params.orderItemId ?? null,
    })
    .single<InventoryTransaction>();
}

export async function markOrderItemIssue(
  orderItemId: string,
  reason: string,
  notes?: string
) {
  const supabase = createClient();
  return supabase
    .rpc("mark_order_item_issue", {
      p_order_item_id: orderItemId,
      p_reason: reason,
      p_notes: notes ?? null,
    })
    .single<OrderItem>();
}

export async function completeOrder(orderId: string) {
  const supabase = createClient();
  return supabase.rpc("complete_order", { p_order_id: orderId }).single<Order>();
}

export async function cancelOrder(orderId: string, notes?: string) {
  const supabase = createClient();
  return supabase
    .rpc("cancel_order", { p_order_id: orderId, p_notes: notes ?? null })
    .single<Order>();
}
