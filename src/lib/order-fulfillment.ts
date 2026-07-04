import type { OrderItemStatus, OrderStatus, UserRole } from "@/types/database";

export type StockBySlot = {
  slot_id: string;
  slot_number: string;
  quantity: number;
};

export type PickInput = {
  slot_id: string;
  quantity: number;
};

export type PickValidationError =
  | "OVER_SLOT_STOCK"
  | "OVER_REQUESTED"
  | "INVALID_QUANTITY"
  | "EMPTY_PICK";

export type OrderItemLike = {
  id: string;
  requested_quantity: number;
  fulfilled_quantity: number;
  status: OrderItemStatus;
};

export type OrderLike = {
  id: string;
  status: OrderStatus;
  prepared_by_user_id: string | null;
};

export function aggregateStockBySlot(
  rows: { slot_id: string; quantity: number; slot_number?: string }[]
): StockBySlot[] {
  const bySlot = new Map<string, StockBySlot>();
  for (const row of rows) {
    const existing = bySlot.get(row.slot_id);
    if (existing) {
      existing.quantity += row.quantity;
    } else {
      bySlot.set(row.slot_id, {
        slot_id: row.slot_id,
        slot_number: row.slot_number ?? row.slot_id,
        quantity: row.quantity,
      });
    }
  }
  return Array.from(bySlot.values());
}

export function sumPickedQuantity(picks: { quantity: number; status?: string }[]): number {
  return picks
    .filter((p) => p.status !== "cancelled")
    .reduce((sum, p) => sum + p.quantity, 0);
}

export function remainingQuantity(requested: number, fulfilled: number): number {
  return Math.max(0, requested - fulfilled);
}

export function parsePickQuantity(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function picksFromValues(values: Record<string, string>): PickInput[] {
  return Object.entries(values)
    .map(([slot_id, value]) => ({
      slot_id,
      quantity: parsePickQuantity(value),
    }))
    .filter((pick) => pick.quantity > 0);
}

export function sumPickInputs(picks: PickInput[]): number {
  return picks.reduce((sum, pick) => sum + pick.quantity, 0);
}

export function maxQuantityForSlot({
  slotAvailable,
  remaining,
  selectedTotal,
  currentSlotQuantity,
}: {
  slotAvailable: number;
  remaining: number;
  selectedTotal: number;
  currentSlotQuantity: number;
}): number {
  const otherSlotsTotal = selectedTotal - currentSlotQuantity;
  const remainingForThisSlot = Math.max(0, remaining - otherSlotsTotal);
  return Math.min(slotAvailable, remainingForThisSlot);
}

export function validatePickInput({
  requested,
  fulfilled,
  pickQty,
  slotAvailable,
}: {
  requested: number;
  fulfilled: number;
  pickQty: number;
  slotAvailable: number;
}): { ok: true } | { ok: false; error: PickValidationError } {
  if (pickQty <= 0) {
    return { ok: false, error: "INVALID_QUANTITY" };
  }
  if (pickQty > slotAvailable) {
    return { ok: false, error: "OVER_SLOT_STOCK" };
  }
  const remaining = remainingQuantity(requested, fulfilled);
  if (pickQty > remaining) {
    return { ok: false, error: "OVER_REQUESTED" };
  }
  return { ok: true };
}

export function validatePickBatch({
  requested,
  fulfilled,
  picks,
  stockBySlot,
}: {
  requested: number;
  fulfilled: number;
  picks: PickInput[];
  stockBySlot: StockBySlot[];
}):
  | { ok: true; totalPick: number }
  | {
      ok: false;
      error: PickValidationError;
      totalPick: number;
      remaining: number;
    } {
  const nonZero = picks.filter((p) => p.quantity > 0);
  const totalPick = sumPickInputs(nonZero);
  const remaining = remainingQuantity(requested, fulfilled);

  if (nonZero.length === 0) {
    return { ok: false, error: "EMPTY_PICK", totalPick: 0, remaining };
  }

  if (totalPick > remaining) {
    return { ok: false, error: "OVER_REQUESTED", totalPick, remaining };
  }

  const stockMap = new Map(stockBySlot.map((s) => [s.slot_id, s.quantity]));

  for (const pick of nonZero) {
    const slotAvailable = stockMap.get(pick.slot_id) ?? 0;
    if (pick.quantity > slotAvailable) {
      return { ok: false, error: "OVER_SLOT_STOCK", totalPick, remaining };
    }
  }

  return { ok: true, totalPick };
}

export function validateMermaInput({
  slotAvailable,
  quantity,
}: {
  slotAvailable: number;
  quantity: number;
}): { ok: true } | { ok: false; error: "INVALID_QUANTITY" | "OVER_SLOT_STOCK" } {
  if (quantity <= 0) {
    return { ok: false, error: "INVALID_QUANTITY" };
  }
  if (quantity > slotAvailable) {
    return { ok: false, error: "OVER_SLOT_STOCK" };
  }
  return { ok: true };
}

export function deriveOrderItemStatus(
  requested: number,
  fulfilled: number,
  hasIssue = false
): OrderItemStatus {
  if (hasIssue) return "issue";
  if (fulfilled >= requested) return "fulfilled";
  if (fulfilled > 0) return "partially_fulfilled";
  return "pending";
}

export function countOrderProgress(items: OrderItemLike[]): {
  total: number;
  done: number;
  label: string;
} {
  const total = items.length;
  const done = items.filter(
    (i) => i.status === "fulfilled" || i.status === "issue" || i.status === "unavailable"
  ).length;
  return { total, done, label: `${done}/${total}` };
}

export function isOrderItemComplete(item: OrderItemLike): boolean {
  return item.status === "fulfilled" || item.status === "issue" || item.status === "unavailable";
}

export function canCompleteOrder(items: OrderItemLike[]): boolean {
  if (items.length === 0) return false;
  return items.every(isOrderItemComplete);
}

export function canCompleteWithIssues(role: UserRole): boolean {
  return role === "admin" || role === "staff";
}

export function orderHasIssues(items: OrderItemLike[]): boolean {
  return items.some((i) => i.status === "issue");
}

export function canUserCompleteOrder(
  items: OrderItemLike[],
  role: UserRole
): { allowed: boolean; reason?: "INCOMPLETE" | "ISSUES_NOT_ALLOWED" } {
  if (!canCompleteOrder(items)) {
    return { allowed: false, reason: "INCOMPLETE" };
  }
  if (orderHasIssues(items) && !canCompleteWithIssues(role)) {
    return { allowed: false, reason: "ISSUES_NOT_ALLOWED" };
  }
  return { allowed: true };
}

export function canStartOrder(
  order: OrderLike,
  currentUserId: string,
  role: UserRole
): { allowed: boolean; reason?: "WRONG_STATUS" | "HANDLED_BY_OTHER" } {
  if (order.status === "completed" || order.status === "cancelled") {
    return { allowed: false, reason: "WRONG_STATUS" };
  }
  if (order.status === "in_progress") {
    if (
      role !== "admin" &&
      order.prepared_by_user_id &&
      order.prepared_by_user_id !== currentUserId
    ) {
      return { allowed: false, reason: "HANDLED_BY_OTHER" };
    }
    return { allowed: true };
  }
  if (order.status === "pending") {
    return { allowed: true };
  }
  return { allowed: false, reason: "WRONG_STATUS" };
}

export function canPickOrderItem(
  order: OrderLike,
  currentUserId: string,
  role: UserRole
): boolean {
  if (order.status !== "in_progress") return false;
  if (role === "admin") return true;
  if (!order.prepared_by_user_id) return true;
  return order.prepared_by_user_id === currentUserId;
}

/** Simulate applying picks and return updated fulfilled qty + status */
export function applyPicks(
  requested: number,
  currentFulfilled: number,
  newPicks: PickInput[]
): { fulfilled_quantity: number; status: OrderItemStatus } {
  const added = newPicks.filter((p) => p.quantity > 0).reduce((s, p) => s + p.quantity, 0);
  const fulfilled_quantity = currentFulfilled + added;
  return {
    fulfilled_quantity,
    status: deriveOrderItemStatus(requested, fulfilled_quantity),
  };
}

/** Simulate merma reducing slot stock */
export function applyMerma(slotAvailable: number, quantity: number): number {
  return Math.max(0, slotAvailable - quantity);
}

/** Idempotency: pick with transaction should not create duplicate OUT */
export function pickAlreadyHasTransaction(pick: { inventory_transaction_id: string | null }): boolean {
  return pick.inventory_transaction_id !== null;
}
