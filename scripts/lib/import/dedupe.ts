import { excelRowKey, productKey } from "./normalize";
import { inventoryId, itemId, slotId, transactionId } from "./uuid";
import type {
  ClassifiedRow,
  DonationItemRecord,
  ImportSummary,
  InboundTransactionRecord,
  InventoryRecord,
} from "./types";
import { INITIAL_STOCK_DATE } from "./types";

export interface DedupeResult {
  classifiedRows: ClassifiedRow[];
  products: DonationItemRecord[];
  inventory: InventoryRecord[];
  inboundTransactions: InboundTransactionRecord[];
  slotNumbers: Set<string>;
  duplicateRowsSkipped: number;
}

export function buildMedicinasCatalog(rows: ClassifiedRow[]): DedupeResult {
  const activeRows = rows.filter((row) => !row.skipped);
  const seenExcelKeys = new Set<string>();
  const productsByKey = new Map<string, DonationItemRecord>();
  const inventoryByKey = new Map<string, InventoryRecord>();
  const inboundByKey = new Map<string, InboundTransactionRecord>();
  const slotNumbers = new Set<string>();
  let duplicateRowsSkipped = 0;

  const classifiedRows = rows.map((row) => {
    if (row.skipped) return row;

    const key = excelRowKey({
      sourceBox: row.sourceBox,
      description: row.cleanedDescription,
      presentation: row.cleanedPresentation,
      unitOfMeasure: row.cleanedUnitOfMeasure,
      category: row.category,
      subcategory: row.subcategory,
    });

    if (seenExcelKeys.has(key)) {
      duplicateRowsSkipped++;
      return {
        ...row,
        skipped: true,
        skipReason: "DUPLICATE_ROW_SKIPPED",
        warnings: [...row.warnings, "DUPLICATE_ROW_SKIPPED"],
      };
    }
    seenExcelKeys.add(key);
    return row;
  });

  for (const row of classifiedRows) {
    if (row.skipped) continue;

    const pKey = productKey({
      description: row.cleanedDescription,
      presentation: row.cleanedPresentation,
      unitOfMeasure: row.cleanedUnitOfMeasure,
      category: row.category,
      subcategory: row.subcategory,
    });

    if (!productsByKey.has(pKey)) {
      productsByKey.set(pKey, {
        id: itemId(pKey),
        category: row.category,
        subcategory: row.subcategory,
        description: row.cleanedDescription,
        presentation: row.cleanedPresentation,
        unitOfMeasure: row.cleanedUnitOfMeasure,
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

      const txKey = `inbound-${invKey}-${row.rowNumber}`;
      inboundByKey.set(txKey, {
        id: transactionId("inbound", txKey),
        donationItemId: product.id,
        slotId: sId,
        quantity: qty,
        notes: "CARGA INICIAL DESDE EXCEL",
        createdAt: INITIAL_STOCK_DATE,
      });
    }
  }

  return {
    classifiedRows,
    products: [...productsByKey.values()],
    inventory: [...inventoryByKey.values()],
    inboundTransactions: [...inboundByKey.values()],
    slotNumbers,
    duplicateRowsSkipped,
  };
}

export function emptySummary(): ImportSummary {
  return {
    productsImported: 0,
    productsImportedWithWarning: 0,
    productsImportedWithoutStock: 0,
    productsSkipped: 0,
    slotsCreated: 0,
    initialStockRecords: 0,
    initialInboundTransactions: 0,
    orderCreated: "NOTA-001",
    orderItemsCreated: 0,
    fulfillmentTransactions: 0,
    nota1RowsSkipped: 0,
    manualReviewRows: 0,
    duplicateRowsSkipped: 0,
  };
}
