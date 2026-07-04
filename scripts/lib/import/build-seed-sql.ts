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
import { WAREHOUSE_ID } from "./types";
import { slotId } from "./uuid";

function sqlValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${sqlEscape(value)}'`;
}

function truncatePreamble(strategy: ImportStrategy): string[] {
  if (strategy !== "fresh") return [];
  return [
    "-- Clear previous seed data (keeps users/profiles/warehouse)",
    "TRUNCATE TABLE",
    "  inventory_transactions,",
    "  order_items,",
    "  orders,",
    "  inventory,",
    "  slot_status_history,",
    "  donation_items,",
    "  slots",
    "RESTART IDENTITY CASCADE;",
    "",
  ];
}

function slotInsert(strategy: ImportStrategy, slotNumbers: string[]): string[] {
  if (slotNumbers.length === 0) return [];
  const values = slotNumbers
    .sort((a, b) => {
      const ai = Number(a);
      const bi = Number(b);
      if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
      return a.localeCompare(b, "es");
    })
    .map((number) => {
      const id = slotId(number);
      return `  ('${id}', '${WAREHOUSE_ID}', '${sqlEscape(number)}', 'Caja ${sqlEscape(number)}', 'active')`;
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
    ";",
    "",
  ];
}

function donationItemsInsert(strategy: ImportStrategy, products: DonationItemRecord[]): string[] {
  if (products.length === 0) return [];
  const values = products.map(
    (p) =>
      `  ('${p.id}', '${sqlEscape(p.category)}', ${sqlValue(p.subcategory)}, '${sqlEscape(p.description)}', ${sqlValue(p.presentation)}, ${sqlValue(p.unitOfMeasure)}, 'active')`
  );

  if (strategy === "upsert") {
    return [
      "INSERT INTO donation_items (id, category, subcategory, description, presentation, unit_of_measurement, status) VALUES",
      values.join(",\n"),
      "ON CONFLICT (id) DO UPDATE SET",
      "  category = EXCLUDED.category,",
      "  subcategory = EXCLUDED.subcategory,",
      "  description = EXCLUDED.description,",
      "  presentation = EXCLUDED.presentation,",
      "  unit_of_measurement = EXCLUDED.unit_of_measurement,",
      "  status = EXCLUDED.status,",
      "  updated_at = now();",
      "",
    ];
  }

  return [
    "INSERT INTO donation_items (id, category, subcategory, description, presentation, unit_of_measurement, status) VALUES",
    values.join(",\n"),
    ";",
    "",
  ];
}

function inventoryInsert(strategy: ImportStrategy, inventory: InventoryRecord[]): string[] {
  if (inventory.length === 0) return [];
  const values = inventory.map(
    (row) => `  ('${row.id}', '${row.slotId}', '${row.donationItemId}', ${row.quantity})`
  );

  if (strategy === "upsert") {
    return [
      "INSERT INTO inventory (id, slot_id, donation_item_id, quantity) VALUES",
      values.join(",\n"),
      "ON CONFLICT (slot_id, donation_item_id) DO UPDATE SET",
      "  quantity = EXCLUDED.quantity,",
      "  updated_at = now();",
      "",
    ];
  }

  return ["INSERT INTO inventory (id, slot_id, donation_item_id, quantity) VALUES", values.join(",\n"), ";", ""];
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

export function buildSeedSql(input: {
  strategy: ImportStrategy;
  slotNumbers: string[];
  products: DonationItemRecord[];
  inventory: InventoryRecord[];
  inboundTransactions: InboundTransactionRecord[];
  order: OrderRecord | null;
  orderItems: OrderItemRecord[];
  fulfillmentTransactions: FulfillmentTransactionRecord[];
  sourceFile: string;
}): string {
  const lines = [
    `-- Seed data from ${input.sourceFile}`,
    `-- Strategy: ${input.strategy}`,
    `-- Generated by scripts/import-excel-inventory.ts`,
    "BEGIN;",
    "",
    ...truncatePreamble(input.strategy),
    ...slotInsert(input.strategy, input.slotNumbers),
    ...donationItemsInsert(input.strategy, input.products),
    ...inventoryInsert(input.strategy, input.inventory),
    ...inboundInsert(input.inboundTransactions),
    ...orderInsert(input.order),
    ...orderItemsInsert(input.orderItems),
    ...fulfillmentInsert(input.fulfillmentTransactions),
    "COMMIT;",
    "",
  ];

  return lines.join("\n");
}
