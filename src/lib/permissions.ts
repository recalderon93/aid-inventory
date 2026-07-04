import type { UserRole } from "@/types/database";

export function canManageUsers(role: UserRole) {
  return role === "admin";
}

export function canManageImportReview(role: UserRole) {
  return role === "admin";
}

export function canCreateSlots(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canManageInventory(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canViewOrders(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canCreateOrders(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canEditOrders(role: UserRole) {
  return role === "admin" || role === "staff";
}

export function canHandleOrders(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canRegisterDonations(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canManageOrders(role: UserRole) {
  return canCreateOrders(role);
}

export function canRecordMerma(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canMarkOrderItemIssue(role: UserRole) {
  return role === "admin" || role === "staff" || role === "collaborator";
}

export function canCompleteOrderWithIssues(role: UserRole) {
  return role === "admin" || role === "staff";
}

export function canReassignOrder(role: UserRole) {
  return role === "admin";
}

export function canCancelOrder(role: UserRole) {
  return role === "admin" || role === "staff";
}

export function canPickOnOrder(
  role: UserRole,
  preparedByUserId: string | null,
  currentUserId: string | null
) {
  if (!canHandleOrders(role) || !currentUserId) return false;
  if (role === "admin") return true;
  if (!preparedByUserId) return true;
  return preparedByUserId === currentUserId;
}

export function inferCategory(subcategory: string): string {
  const sub = subcategory.trim().toUpperCase();
  if (sub === "INSUMO MEDICO") return "Medical Supply";
  const medicineKeywords = [
    "ANALGES", "ANTIBIOT", "ANTIHIPERT", "ANTIINFLAM", "ANTISEPT",
    "CORTICO", "VITAMINA", "ANTIGRIP", "ANTIASMAT", "LAXANTE",
  ];
  if (medicineKeywords.some((k) => sub.includes(k))) return "Medicine";
  return "Other";
}

export function suggestSlotsForItem(
  inventory: { slot_id: string; quantity: number; slot?: { number: string } }[],
  requestedQty: number
) {
  const suggestions: { slot_id: string; slot_number: string; quantity: number }[] = [];
  let remaining = requestedQty;
  const sorted = [...inventory].sort((a, b) => b.quantity - a.quantity);

  for (const row of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantity, remaining);
    if (take > 0) {
      suggestions.push({
        slot_id: row.slot_id,
        slot_number: row.slot?.number ?? row.slot_id,
        quantity: take,
      });
      remaining -= take;
    }
  }

  return { suggestions, fulfilled: requestedQty - remaining, remaining };
}

export function generateOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${date}-${rand}`;
}

export function getOrderStatusVariant(
  status: string
): "default" | "secondary" | "success" | "warning" | "destructive" {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
    case "ready_for_pickup":
      return "warning";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}
