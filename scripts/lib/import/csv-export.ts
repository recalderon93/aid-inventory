import { csvEscape } from "./normalize";
import { MANUAL_REVIEW_COLUMNS } from "./manual-review";
import type {
  ClassifiedRow,
  DonationItemRecord,
  FulfillmentTransactionRecord,
  InboundTransactionRecord,
  InventoryRecord,
  ManualReviewRow,
  OrderItemRecord,
  RawExcelRow,
} from "./types";

export function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function manualReviewToCsv(rows: ManualReviewRow[]): string {
  const lines = [MANUAL_REVIEW_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(MANUAL_REVIEW_COLUMNS.map((col) => csvEscape(String(row[col] ?? ""))).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function medicinasCleanCsv(rows: ClassifiedRow[]): string {
  return rowsToCsv(
    [
      "row_number",
      "source_box",
      "category",
      "subcategory",
      "description",
      "presentation",
      "quantity",
      "unit_of_measure",
      "classification",
      "skipped",
      "skip_reason",
      "warnings",
    ],
    rows.map((row) => ({
      row_number: String(row.rowNumber),
      source_box: row.sourceBox,
      category: row.category,
      subcategory: row.subcategory,
      description: row.cleanedDescription,
      presentation: row.cleanedPresentation ?? "",
      quantity: row.quantity === null ? "" : String(row.quantity),
      unit_of_measure: row.cleanedUnitOfMeasure ?? "",
      classification: row.originalClassification,
      skipped: String(row.skipped),
      skip_reason: row.skipReason ?? "",
      warnings: row.warnings.join("|"),
    }))
  );
}

export function medicinasProductsCsv(products: DonationItemRecord[]): string {
  return rowsToCsv(
    ["id", "category", "subcategory", "description", "presentation", "unit_of_measure", "product_key"],
    products.map((p) => ({
      id: p.id,
      category: p.category,
      subcategory: p.subcategory,
      description: p.description,
      presentation: p.presentation ?? "",
      unit_of_measure: p.unitOfMeasure ?? "",
      product_key: p.productKey,
    }))
  );
}

export function medicinasInventoryCsv(inventory: InventoryRecord[]): string {
  return rowsToCsv(
    ["id", "slot_id", "slot_number", "donation_item_id", "quantity"],
    inventory.map((row) => ({
      id: row.id,
      slot_id: row.slotId,
      slot_number: row.slotNumber,
      donation_item_id: row.donationItemId,
      quantity: String(row.quantity),
    }))
  );
}

export function medicinasInboundCsv(transactions: InboundTransactionRecord[]): string {
  return rowsToCsv(
    ["id", "donation_item_id", "slot_id", "quantity", "notes", "created_at"],
    transactions.map((tx) => ({
      id: tx.id,
      donation_item_id: tx.donationItemId,
      slot_id: tx.slotId,
      quantity: String(tx.quantity),
      notes: tx.notes,
      created_at: tx.createdAt,
    }))
  );
}

export function nota1CleanCsv(rows: ClassifiedRow[]): string {
  return medicinasCleanCsv(rows);
}

export function nota1OrderItemsCsv(items: OrderItemRecord[]): string {
  return rowsToCsv(
    ["id", "order_id", "donation_item_id", "slot_id", "slot_number", "requested_quantity", "fulfilled_quantity", "status", "notes"],
    items.map((item) => ({
      id: item.id,
      order_id: item.orderId,
      donation_item_id: item.donationItemId,
      slot_id: item.slotId,
      slot_number: item.slotNumber,
      requested_quantity: String(item.requestedQuantity),
      fulfilled_quantity: String(item.fulfilledQuantity),
      status: item.status,
      notes: item.notes,
    }))
  );
}

export function nota1FulfillmentCsv(transactions: FulfillmentTransactionRecord[]): string {
  return rowsToCsv(
    ["id", "order_id", "order_item_id", "donation_item_id", "from_slot_id", "quantity", "notes", "created_at"],
    transactions.map((tx) => ({
      id: tx.id,
      order_id: tx.orderId,
      order_item_id: tx.orderItemId,
      donation_item_id: tx.donationItemId,
      from_slot_id: tx.fromSlotId,
      quantity: String(tx.quantity),
      notes: tx.notes,
      created_at: tx.createdAt,
    }))
  );
}

export function ignoredSheetCsv(rows: RawExcelRow[]): string {
  return rowsToCsv(
    ["sheet_name", "row_number", "source_box", "classification", "description", "presentation", "quantity", "unit_of_measure", "salida"],
    rows.map((row) => ({
      sheet_name: row.sheetName,
      row_number: String(row.rowNumber),
      source_box: row.sourceBox,
      classification: row.classification,
      description: row.description,
      presentation: row.presentation,
      quantity: row.quantity,
      unit_of_measure: row.unitOfMeasure,
      salida: row.salida,
    }))
  );
}
