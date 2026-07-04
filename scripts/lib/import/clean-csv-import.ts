import {
  cleanPresentation,
  cleanText,
  cleanUnitOfMeasure,
  parseQuantity,
  productKey,
} from "./normalize";
import { parseCsvFile } from "./csv-parse";
import { createNota1Order, processNota1Rows } from "./match-nota1";
import { processRawRows } from "./clean-rows";
import type {
  ClassifiedRow,
  DonationItemRecord,
  FulfillmentTransactionRecord,
  InboundTransactionRecord,
  InventoryRecord,
  OrderItemRecord,
  OrderRecord,
} from "./types";
import { INITIAL_STOCK_DATE, WAREHOUSE_ID } from "./types";
import { deterministicId, inventoryId, itemId, slotId, transactionId } from "./uuid";

export interface CleanCsvRow {
  rowNumber: number;
  sourceBox: string | null;
  category: string;
  subcategory: string;
  description: string;
  presentation: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  classification: string | null;
  warnings: string[];
  consolidatedFromRows: string | null;
  consolidatedQuantityAdded: number | null;
}

export interface ManualReviewCsvRow {
  sheetName: string;
  rowNumber: number;
  actionTaken: string;
  reviewStatus: string;
  sourceBox: string;
  inferredCategory: string;
  inferredSubcategory: string;
  description: string;
  cleanedDescription: string;
  presentation: string;
  cleanedPresentation: string;
  quantity: string;
  unitOfMeasure: string;
  cleanedUnitOfMeasure: string;
  matchedProductId: string;
  reason: string;
  suggestedFix: string;
  originalRowJson: string;
}

export interface ConsolidationLogRow {
  sourceRowNumber: number;
  sourceBox: string;
  description: string;
  presentation: string;
  unitOfMeasure: string;
  quantityAdded: number;
  action: string;
  targetRowNumber: number;
  targetQuantityAfter: number;
  reason: string;
}

export interface ImportReviewRecord {
  id: string;
  entityType: string;
  entityId: string | null;
  sourceFile: string;
  sourceSheet: string | null;
  sourceRowNumber: number | null;
  actionTaken: string;
  warningCode: string;
  warningMessage: string | null;
  originalRowJson: string | null;
  suggestedFix: string | null;
  reviewStatus: "PENDING_REVIEW";
}

export interface ImportAuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  sourceFile: string;
  sourceRowNumber: number | null;
  metadata: Record<string, unknown>;
}

export interface CleanImportResult {
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
  summary: CleanImportSummary;
}

export interface CleanImportSummary {
  productsImported: number;
  stockRecords: number;
  inboundTransactions: number;
  manualReviewRecords: number;
  consolidationAuditRecords: number;
  rowsIgnoredFromHoja1Insumos: number;
  orderNota001Created: boolean;
  orderItemsCreated: number;
  warnings: number;
}

const INBOUND_NOTES = "CARGA INICIAL DESDE CSV LIMPIO - medicinas_clean_updated.csv";

function parseCleanCsvRow(record: Record<string, string>): CleanCsvRow | null {
  const description = cleanText(record.description);
  if (!description) return null;

  const skipped = String(record.skipped ?? "").toLowerCase() === "true";
  if (skipped) return null;

  const sourceBox = cleanText(record.source_box);
  const consolidatedQty = record.consolidated_quantity_added
    ? parseQuantity(record.consolidated_quantity_added)
    : null;

  return {
    rowNumber: Number(record.row_number) || 0,
    sourceBox,
    category: cleanText(record.category) ?? "MEDICINAS",
    subcategory: cleanText(record.subcategory) ?? "SIN CLASIFICAR",
    description,
    presentation: cleanPresentation(record.presentation),
    quantity: parseQuantity(record.quantity),
    unitOfMeasure: cleanUnitOfMeasure(record.unit_of_measure),
    classification: cleanText(record.classification),
    warnings: String(record.warnings ?? "")
      .split("|")
      .map((w) => w.trim())
      .filter(Boolean),
    consolidatedFromRows: record.consolidated_from_rows?.trim() || null,
    consolidatedQuantityAdded: consolidatedQty,
  };
}

function buildCatalogFromCleanRows(rows: CleanCsvRow[]): {
  products: DonationItemRecord[];
  inventory: InventoryRecord[];
  inboundTransactions: InboundTransactionRecord[];
  slotNumbers: Set<string>;
} {
  const productsByKey = new Map<string, DonationItemRecord>();
  const inventoryByKey = new Map<string, InventoryRecord>();
  const inboundByKey = new Map<string, InboundTransactionRecord>();
  const slotNumbers = new Set<string>();

  for (const row of rows) {
    const pKey = productKey({
      description: row.description,
      presentation: row.presentation,
      unitOfMeasure: row.unitOfMeasure,
      category: row.category,
      subcategory: row.subcategory,
    });

    if (!productsByKey.has(pKey)) {
      productsByKey.set(pKey, {
        id: itemId(pKey),
        category: row.category,
        subcategory: row.subcategory,
        description: row.description,
        presentation: row.presentation,
        unitOfMeasure: row.unitOfMeasure,
        productKey: pKey,
      });
    }

    if (!row.sourceBox) continue;
    slotNumbers.add(row.sourceBox);

    const product = productsByKey.get(pKey)!;
    const sId = slotId(row.sourceBox);
    const invKey = `${sId}|${product.id}`;
    const qty = row.quantity ?? 0;

    if (qty > 0) {
      const existing = inventoryByKey.get(invKey);
      if (existing) {
        existing.quantity += qty;
      } else {
        inventoryByKey.set(invKey, {
          id: inventoryId(sId, product.id),
          slotId: sId,
          slotNumber: row.sourceBox,
          donationItemId: product.id,
          quantity: qty,
          inventoryKey: invKey,
        });
      }

      const txKey = `inbound-clean-${invKey}-row-${row.rowNumber}`;
      inboundByKey.set(txKey, {
        id: transactionId("inbound", txKey),
        donationItemId: product.id,
        slotId: sId,
        quantity: qty,
        notes: INBOUND_NOTES,
        createdAt: INITIAL_STOCK_DATE,
      });
    }
  }

  return {
    products: [...productsByKey.values()],
    inventory: [...inventoryByKey.values()],
    inboundTransactions: [...inboundByKey.values()],
    slotNumbers,
  };
}

function findProductId(
  products: DonationItemRecord[],
  parts: {
    description: string;
    presentation: string | null;
    unitOfMeasure: string | null;
    category?: string;
    subcategory?: string;
  }
): string | null {
  if (parts.category && parts.subcategory) {
    const key = productKey({
      description: cleanText(parts.description) ?? parts.description,
      presentation: cleanPresentation(parts.presentation),
      unitOfMeasure: cleanUnitOfMeasure(parts.unitOfMeasure),
      category: cleanText(parts.category) ?? parts.category,
      subcategory: cleanText(parts.subcategory) ?? parts.subcategory,
    });
    const exact = products.find((p) => p.productKey === key);
    if (exact) return exact.id;
  }

  const desc = cleanText(parts.description) ?? parts.description;
  const pres = cleanPresentation(parts.presentation);
  const unit = cleanUnitOfMeasure(parts.unitOfMeasure);
  const matches = products.filter(
    (p) =>
      p.description === desc &&
      (p.presentation ?? "") === (pres ?? "") &&
      (p.unitOfMeasure ?? "") === (unit ?? "")
  );
  return matches.length === 1 ? matches[0]!.id : null;
}

function parseManualReviewRow(record: Record<string, string>): ManualReviewCsvRow {
  return {
    sheetName: record.sheet_name ?? "",
    rowNumber: Number(record.row_number) || 0,
    actionTaken: record.action_taken ?? "",
    reviewStatus: record.review_status ?? "PENDING_REVIEW",
    sourceBox: record.source_box ?? "",
    inferredCategory: record.inferred_category ?? "",
    inferredSubcategory: record.inferred_subcategory ?? "",
    description: record.description ?? "",
    cleanedDescription: record.cleaned_description ?? "",
    presentation: record.presentation ?? "",
    cleanedPresentation: record.cleaned_presentation ?? "",
    quantity: record.quantity ?? "",
    unitOfMeasure: record.unit_of_measure ?? "",
    cleanedUnitOfMeasure: record.cleaned_unit_of_measure ?? "",
    matchedProductId: record.matched_product_id ?? "",
    reason: record.reason ?? "",
    suggestedFix: record.suggested_fix ?? "",
    originalRowJson: record.original_row_json ?? "",
  };
}

function buildReviewItems(
  rows: ManualReviewCsvRow[],
  products: DonationItemRecord[],
  sourceFile: string
): { items: ImportReviewRecord[]; productsNeedingReview: Set<string> } {
  const items: ImportReviewRecord[] = [];
  const productsNeedingReview = new Set<string>();

  for (const row of rows) {
    const entityId = findProductId(products, {
      description: row.cleanedDescription || row.description,
      presentation: row.cleanedPresentation || row.presentation || null,
      unitOfMeasure: row.cleanedUnitOfMeasure || row.unitOfMeasure || null,
      category: row.inferredCategory,
      subcategory: row.inferredSubcategory,
    });

    const entityType =
      row.actionTaken === "ORDER_ITEM_SKIPPED" || row.actionTaken === "OUT_TRANSACTION_SKIPPED"
        ? "order_item"
        : "donation_item";

    if (entityId && entityType === "donation_item") {
      productsNeedingReview.add(entityId);
    }

    const id = deterministicId(
      `import-review-${sourceFile}-${row.sheetName}-${row.rowNumber}-${row.reason}`
    );

    items.push({
      id,
      entityType,
      entityId,
      sourceFile,
      sourceSheet: row.sheetName || null,
      sourceRowNumber: row.rowNumber || null,
      actionTaken: row.actionTaken,
      warningCode: row.reason,
      warningMessage: row.reason,
      originalRowJson: row.originalRowJson || null,
      suggestedFix: row.suggestedFix || null,
      reviewStatus: "PENDING_REVIEW",
    });
  }

  return { items, productsNeedingReview };
}

function parseConsolidationRow(record: Record<string, string>): ConsolidationLogRow {
  return {
    sourceRowNumber: Number(record.source_row_number) || 0,
    sourceBox: record.source_box ?? "",
    description: record.description ?? "",
    presentation: record.presentation ?? "",
    unitOfMeasure: record.unit_of_measure ?? "",
    quantityAdded: Number(record.quantity_added) || 0,
    action: record.action ?? "",
    targetRowNumber: Number(record.target_row_number) || 0,
    targetQuantityAfter: Number(record.target_quantity_after) || 0,
    reason: record.reason ?? "",
  };
}

function buildConsolidationAudit(
  rows: ConsolidationLogRow[],
  products: DonationItemRecord[],
  sourceFile: string
): ImportAuditRecord[] {
  return rows.map((row) => {
    const entityId = findProductId(products, {
      description: row.description,
      presentation: row.presentation || null,
      unitOfMeasure: row.unitOfMeasure || null,
    });

    const id = deterministicId(
      `import-audit-consolidation-${sourceFile}-${row.sourceRowNumber}-${row.targetRowNumber}`
    );

    return {
      id,
      action: row.action,
      entityType: "inventory",
      entityId,
      sourceFile,
      sourceRowNumber: row.sourceRowNumber,
      metadata: {
        source_box: row.sourceBox,
        description: row.description,
        presentation: row.presentation,
        unit_of_measure: row.unitOfMeasure,
        quantity_added: row.quantityAdded,
        target_row_number: row.targetRowNumber,
        target_quantity_after: row.targetQuantityAfter,
        reason: row.reason,
      },
    };
  });
}

function loadNota1IfAvailable(nota1Path: string | null): ClassifiedRow[] {
  if (!nota1Path) return [];
  try {
    const records = parseCsvFile(nota1Path);
    const rawRows = records.map((record) => ({
      sheetName: "NOTA 1",
      rowNumber: Number(record.row_number) || 0,
      sourceBox: record.source_box ?? "",
      classification: record.classification ?? "",
      description: record.description ?? "",
      presentation: record.presentation ?? "",
      quantity: record.quantity ?? "",
      unitOfMeasure: record.unit_of_measure ?? "",
      salida: record.salida ?? "",
    }));
    return processRawRows(rawRows);
  } catch {
    return [];
  }
}

export function runCleanImport(input: {
  cleanCsvPath: string;
  manualReviewCsvPath: string;
  consolidationLogPath: string;
  nota1CleanPath?: string | null;
}): CleanImportResult {
  const cleanRecords = parseCsvFile(input.cleanCsvPath);
  const cleanRows = cleanRecords
    .map(parseCleanCsvRow)
    .filter((row): row is CleanCsvRow => row !== null);

  const catalog = buildCatalogFromCleanRows(cleanRows);

  const manualRecords = parseCsvFile(input.manualReviewCsvPath);
  const manualRows = manualRecords.map(parseManualReviewRow);
  const manualReviewSource = "manual_review_remaining_updated.csv";

  const { items: reviewItems, productsNeedingReview } = buildReviewItems(
    manualRows,
    catalog.products,
    manualReviewSource
  );

  const consolidationRecords = parseCsvFile(input.consolidationLogPath);
  const consolidationRows = consolidationRecords.map(parseConsolidationRow);
  const auditLogs = buildConsolidationAudit(
    consolidationRows,
    catalog.products,
    "duplicate_consolidation_log.csv"
  );

  const nota1Rows = loadNota1IfAvailable(input.nota1CleanPath ?? null);
  let order: OrderRecord | null = null;
  let orderItems: OrderItemRecord[] = [];
  let fulfillmentTransactions: FulfillmentTransactionRecord[] = [];
  let finalInventory = catalog.inventory;

  if (nota1Rows.length > 0) {
    const nota1Result = processNota1Rows(nota1Rows, catalog.products, catalog.inventory);
    order = createNota1Order();
    orderItems = nota1Result.orderItems;
    fulfillmentTransactions = nota1Result.fulfillmentTransactions;
    finalInventory = nota1Result.adjustedInventory;
  }

  const warningCount = cleanRows.filter((r) => r.warnings.length > 0).length + manualRows.length;

  return {
    slotNumbers: [...catalog.slotNumbers].sort((a, b) => {
      const ai = Number(a);
      const bi = Number(b);
      if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
      return a.localeCompare(b, "es");
    }),
    products: catalog.products,
    inventory: finalInventory,
    inboundTransactions: catalog.inboundTransactions,
    order,
    orderItems,
    fulfillmentTransactions,
    reviewItems,
    auditLogs,
    productsNeedingReview,
    summary: {
      productsImported: catalog.products.length,
      stockRecords: finalInventory.length,
      inboundTransactions: catalog.inboundTransactions.length,
      manualReviewRecords: reviewItems.length,
      consolidationAuditRecords: auditLogs.length,
      rowsIgnoredFromHoja1Insumos: 0,
      orderNota001Created: order !== null,
      orderItemsCreated: orderItems.length,
      warnings: warningCount,
    },
  };
}

export { WAREHOUSE_ID };
