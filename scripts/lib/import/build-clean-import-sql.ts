import { sqlEscape } from "./normalize";
import type {
  DonationItemRecord,
  FulfillmentTransactionRecord,
  ImportStrategy,
  InboundTransactionRecord,
  InventoryRecord,
  OrderItemRecord,
  OrderRecord,
} from "./types";
import type { ImportAuditRecord, ImportReviewRecord } from "./clean-csv-import";
import { slotId } from "./uuid";

function sqlValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${sqlEscape(value)}'`;
}

function sqlJson(value: string | null): string {
  if (!value) return "NULL";
  return `'${sqlEscape(value)}'::jsonb`;
}

function sqlMetadata(metadata: Record<string, unknown>): string {
  return `'${sqlEscape(JSON.stringify(metadata))}'::jsonb`;
}

function slotInsert(strategy: ImportStrategy, slotNumbers: string[]): string[] {
  if (slotNumbers.length === 0) return [];
  const values = slotNumbers.map((number) => {
    const id = slotId(number);
    return `  ('${id}', '00000000-0000-0000-0000-000000000001', '${sqlEscape(number)}', 'Caja ${sqlEscape(number)}', 'active')`;
  });

  if (strategy === "upsert") {
    return [
      "INSERT INTO slots (id, warehouse_id, number, name, status) VALUES",
      values.join(",\n"),
      "ON CONFLICT (warehouse_id, number) DO UPDATE SET",
      "  name = EXCLUDED.name,",
      "  status = EXCLUDED.status,",
      "  updated_at = now();",
      "",
    ];
  }

  return [
    "INSERT INTO slots (id, warehouse_id, number, name, status) VALUES",
    values.join(",\n"),
    "ON CONFLICT (warehouse_id, number) DO NOTHING;",
    "",
  ];
}

function donationItemsInsert(
  strategy: ImportStrategy,
  products: DonationItemRecord[],
  needsReviewIds: Set<string>
): string[] {
  if (products.length === 0) return [];
  const values = products.map(
    (p) =>
      `  ('${p.id}', '${sqlEscape(p.category)}', ${sqlValue(p.subcategory)}, '${sqlEscape(p.description)}', ${sqlValue(p.presentation)}, ${sqlValue(p.unitOfMeasure)}, 'active', ${needsReviewIds.has(p.id)})`
  );

  return [
    "INSERT INTO donation_items (id, category, subcategory, description, presentation, unit_of_measurement, status, needs_review) VALUES",
    values.join(",\n"),
    "ON CONFLICT (id) DO UPDATE SET",
    "  category = EXCLUDED.category,",
    "  subcategory = EXCLUDED.subcategory,",
    "  description = EXCLUDED.description,",
    "  presentation = EXCLUDED.presentation,",
    "  unit_of_measurement = EXCLUDED.unit_of_measurement,",
    "  status = EXCLUDED.status,",
    "  needs_review = EXCLUDED.needs_review,",
    "  updated_at = now();",
    "",
  ];
}

function inventoryInsert(inventory: InventoryRecord[]): string[] {
  if (inventory.length === 0) return [];
  const values = inventory.map(
    (row) => `  ('${row.id}', '${row.slotId}', '${row.donationItemId}', ${row.quantity})`
  );
  return [
    "INSERT INTO inventory (id, slot_id, donation_item_id, quantity) VALUES",
    values.join(",\n"),
    "ON CONFLICT (slot_id, donation_item_id) DO UPDATE SET",
    "  quantity = EXCLUDED.quantity,",
    "  updated_at = now();",
    "",
  ];
}

function inboundInsert(transactions: InboundTransactionRecord[]): string[] {
  if (transactions.length === 0) return [];
  const values = transactions.map(
    (tx) =>
      `  ('${tx.id}', 'inbound', '${tx.donationItemId}', NULL, '${tx.slotId}', NULL, ${tx.quantity}, NULL, '${sqlEscape(tx.notes)}', '${tx.createdAt}')`
  );
  return [
    "INSERT INTO inventory_transactions (id, type, donation_item_id, from_slot_id, to_slot_id, order_id, quantity, created_by_user_id, notes, created_at) VALUES",
    values.join(",\n"),
    "ON CONFLICT (id) DO NOTHING;",
    "",
  ];
}

function orderInsert(order: OrderRecord | null): string[] {
  if (!order) return [];
  return [
    "INSERT INTO orders (id, order_number, warehouse_id, requester_name, requester_city, requester_state, requester_address, requester_notes, status, created_at, completed_at) VALUES",
    `  ('${order.id}', '${sqlEscape(order.orderNumber)}', '${order.warehouseId}', '${sqlEscape(order.requesterName)}', '${sqlEscape(order.requesterCity)}', '${sqlEscape(order.requesterState)}', '${sqlEscape(order.requesterAddress)}', '${sqlEscape(order.requesterNotes)}', '${order.status}', '${order.createdAt}', '${order.completedAt}')`,
    "ON CONFLICT (order_number) DO UPDATE SET",
    "  requester_name = EXCLUDED.requester_name,",
    "  requester_city = EXCLUDED.requester_city,",
    "  requester_state = EXCLUDED.requester_state,",
    "  requester_address = EXCLUDED.requester_address,",
    "  requester_notes = EXCLUDED.requester_notes,",
    "  status = EXCLUDED.status,",
    "  completed_at = EXCLUDED.completed_at,",
    "  updated_at = now();",
    "",
  ];
}

function orderItemsInsert(items: OrderItemRecord[]): string[] {
  if (items.length === 0) return [];
  const values = items.map(
    (item) =>
      `  ('${item.id}', '${item.orderId}', '${item.donationItemId}', ${item.requestedQuantity}, ${item.fulfilledQuantity}, '${item.status}')`
  );
  return [
    "INSERT INTO order_items (id, order_id, donation_item_id, requested_quantity, fulfilled_quantity, status) VALUES",
    values.join(",\n"),
    "ON CONFLICT (id) DO UPDATE SET",
    "  requested_quantity = EXCLUDED.requested_quantity,",
    "  fulfilled_quantity = EXCLUDED.fulfilled_quantity,",
    "  status = EXCLUDED.status,",
    "  updated_at = now();",
    "",
  ];
}

function fulfillmentInsert(transactions: FulfillmentTransactionRecord[]): string[] {
  if (transactions.length === 0) return [];
  const values = transactions.map(
    (tx) =>
      `  ('${tx.id}', 'order_fulfillment', '${tx.donationItemId}', '${tx.fromSlotId}', NULL, '${tx.orderId}', ${tx.quantity}, NULL, '${sqlEscape(tx.notes)}', '${tx.createdAt}')`
  );
  return [
    "INSERT INTO inventory_transactions (id, type, donation_item_id, from_slot_id, to_slot_id, order_id, quantity, created_by_user_id, notes, created_at) VALUES",
    values.join(",\n"),
    "ON CONFLICT (id) DO NOTHING;",
    "",
  ];
}

function reviewItemsInsert(items: ImportReviewRecord[]): string[] {
  if (items.length === 0) return [];
  const values = items.map(
    (item) =>
      `  ('${item.id}', '${sqlEscape(item.entityType)}', ${item.entityId ? `'${item.entityId}'` : "NULL"}, '${sqlEscape(item.sourceFile)}', ${sqlValue(item.sourceSheet)}, ${item.sourceRowNumber ?? "NULL"}, '${sqlEscape(item.actionTaken)}', '${sqlEscape(item.warningCode)}', ${sqlValue(item.warningMessage)}, ${sqlJson(item.originalRowJson)}, ${sqlValue(item.suggestedFix)}, '${item.reviewStatus}')`
  );
  return [
    "INSERT INTO import_review_items (id, entity_type, entity_id, source_file, source_sheet, source_row_number, action_taken, warning_code, warning_message, original_row_json, suggested_fix, review_status) VALUES",
    values.join(",\n"),
    "ON CONFLICT (id) DO UPDATE SET",
    "  entity_type = EXCLUDED.entity_type,",
    "  entity_id = EXCLUDED.entity_id,",
    "  action_taken = EXCLUDED.action_taken,",
    "  warning_code = EXCLUDED.warning_code,",
    "  warning_message = EXCLUDED.warning_message,",
    "  original_row_json = EXCLUDED.original_row_json,",
    "  suggested_fix = EXCLUDED.suggested_fix,",
    "  review_status = CASE",
    "    WHEN import_review_items.review_status IN ('RESOLVED', 'IGNORED') THEN import_review_items.review_status",
    "    ELSE EXCLUDED.review_status",
    "  END,",
    "  updated_at = now();",
    "",
  ];
}

function auditLogsInsert(logs: ImportAuditRecord[]): string[] {
  if (logs.length === 0) return [];
  const values = logs.map(
    (log) =>
      `  ('${log.id}', '${sqlEscape(log.action)}', '${sqlEscape(log.entityType)}', ${log.entityId ? `'${log.entityId}'` : "NULL"}, '${sqlEscape(log.sourceFile)}', ${log.sourceRowNumber ?? "NULL"}, ${sqlMetadata(log.metadata)})`
  );
  return [
    "INSERT INTO import_audit_logs (id, action, entity_type, entity_id, source_file, source_row_number, metadata) VALUES",
    values.join(",\n"),
    "ON CONFLICT (id) DO NOTHING;",
    "",
  ];
}

export function buildCleanImportSql(input: {
  strategy: ImportStrategy;
  slotNumbers: string[];
  products: DonationItemRecord[];
  inventory: InventoryRecord[];
  inboundTransactions: InboundTransactionRecord[];
  order: OrderRecord | null;
  orderItems: OrderItemRecord[];
  fulfillmentTransactions: FulfillmentTransactionRecord[];
  reviewItems: ImportReviewRecord[];
  auditLogs: ImportAuditRecord[];
  productsNeedingReview: Set<string>;
}): string {
  const lines = [
    "-- Production seed from medicinas_clean_updated.csv",
    "-- Generated by scripts/import-clean-inventory.ts",
    `-- Strategy: ${input.strategy}`,
    "BEGIN;",
    "",
    ...slotInsert(input.strategy, input.slotNumbers),
    ...donationItemsInsert(input.strategy, input.products, input.productsNeedingReview),
    ...inventoryInsert(input.inventory),
    ...inboundInsert(input.inboundTransactions),
    ...orderInsert(input.order),
    ...orderItemsInsert(input.orderItems),
    ...fulfillmentInsert(input.fulfillmentTransactions),
    ...reviewItemsInsert(input.reviewItems),
    ...auditLogsInsert(input.auditLogs),
    "COMMIT;",
    "",
  ];

  return lines.join("\n");
}
