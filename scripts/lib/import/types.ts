export type ImportStrategy = "fresh" | "upsert";

export type ReviewAction =
  | "IMPORTED_WITH_WARNING"
  | "SKIPPED"
  | "PRODUCT_IMPORTED_WITHOUT_STOCK"
  | "ORDER_ITEM_SKIPPED"
  | "OUT_TRANSACTION_SKIPPED"
  | "DUPLICATE_SKIPPED";

export interface RawExcelRow {
  sheetName: string;
  rowNumber: number;
  sourceBox: string;
  classification: string;
  description: string;
  presentation: string;
  quantity: string;
  unitOfMeasure: string;
  salida: string;
  categoryColumn?: string;
}

export interface CleanedRow {
  sheetName: string;
  rowNumber: number;
  sourceBox: string;
  originalClassification: string;
  normalizedClassification: string;
  description: string;
  cleanedDescription: string;
  presentation: string | null;
  cleanedPresentation: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  cleanedUnitOfMeasure: string | null;
  salida: string | null;
  categoryColumn: string | null;
  warnings: string[];
  skipped: boolean;
  skipReason?: string;
}

export interface ClassifiedRow extends CleanedRow {
  category: string;
  subcategory: string;
  classificationUnclear: boolean;
}

export interface DonationItemRecord {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  presentation: string | null;
  unitOfMeasure: string | null;
  productKey: string;
}

export interface InventoryRecord {
  id: string;
  slotId: string;
  slotNumber: string;
  donationItemId: string;
  quantity: number;
  inventoryKey: string;
}

export interface InboundTransactionRecord {
  id: string;
  donationItemId: string;
  slotId: string;
  quantity: number;
  notes: string;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  warehouseId: string;
  requesterName: string;
  requesterCity: string;
  requesterState: string;
  requesterAddress: string;
  requesterNotes: string;
  status: "completed";
  createdAt: string;
  completedAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  donationItemId: string;
  slotId: string;
  slotNumber: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  status: "fulfilled";
  notes: string;
}

export interface FulfillmentTransactionRecord {
  id: string;
  orderId: string;
  orderItemId: string;
  donationItemId: string;
  fromSlotId: string;
  quantity: number;
  notes: string;
  createdAt: string;
}

export interface ManualReviewRow {
  sheet_name: string;
  row_number: number;
  action_taken: ReviewAction;
  review_status: "PENDING_REVIEW";
  source_box: string;
  original_classification: string;
  normalized_classification: string;
  inferred_category: string;
  inferred_subcategory: string;
  description: string;
  cleaned_description: string;
  presentation: string;
  cleaned_presentation: string;
  quantity: string;
  unit_of_measure: string;
  cleaned_unit_of_measure: string;
  salida: string;
  matched_product_id: string;
  matched_order_id: string;
  reason: string;
  suggested_fix: string;
  original_row_json: string;
}

export interface ImportSummary {
  productsImported: number;
  productsImportedWithWarning: number;
  productsImportedWithoutStock: number;
  productsSkipped: number;
  slotsCreated: number;
  initialStockRecords: number;
  initialInboundTransactions: number;
  orderCreated: string;
  orderItemsCreated: number;
  fulfillmentTransactions: number;
  nota1RowsSkipped: number;
  manualReviewRows: number;
  duplicateRowsSkipped: number;
}

export interface ImportResult {
  slotNumbers: string[];
  medicinasClean: ClassifiedRow[];
  medicinasProducts: DonationItemRecord[];
  medicinasInventory: InventoryRecord[];
  medicinasInbound: InboundTransactionRecord[];
  nota1Clean: ClassifiedRow[];
  nota1OrderItems: OrderItemRecord[];
  nota1Fulfillment: FulfillmentTransactionRecord[];
  order: OrderRecord | null;
  manualReview: ManualReviewRow[];
  ignoredInsumos: RawExcelRow[];
  ignoredHoja1: RawExcelRow[];
  summary: ImportSummary;
}

export const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000001";
export const INITIAL_STOCK_DATE = "2026-07-01T00:00:00.000Z";
export const ORDER_DISPATCH_DATE = "2026-07-01T00:00:00.000Z";
export const ORDER_DELIVERY_DATE = "2026-07-02T00:00:00.000Z";
