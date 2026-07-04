export const queryKeys = {
  slots: (search: string) => ["slots", "list", search] as const,
  slotsNumbers: () => ["slots", "numbers"] as const,
  inventory: (filters: { search: string; category: string }) =>
    ["inventory", "list", filters] as const,
  inventoryCategories: () => ["inventory", "categories"] as const,
  ordersPending: () => ["orders", "pending"] as const,
  ordersInProgress: () => ["orders", "in_progress"] as const,
  ordersCompleted: () => ["orders", "completed"] as const,
  transactions: (filters: {
    type: string;
    productSearch: string;
    slotId: string;
    dateFrom: string;
    dateTo: string;
  }) => ["transactions", "list", filters] as const,
  users: () => ["users", "list"] as const,
  importReview: (filters: {
    status: string;
    warning: string;
    action: string;
    entity: string;
    search: string;
  }) => ["import-review", "list", filters] as const,
};

export function listScrollKey(parts: readonly unknown[]): string {
  return `list-scroll:${JSON.stringify(parts)}`;
}
