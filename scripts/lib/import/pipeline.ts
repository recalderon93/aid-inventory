import { buildSeedSql } from "./build-seed-sql";
import { processRawRows } from "./clean-rows";
import {
  ignoredSheetCsv,
  manualReviewToCsv,
  medicinasCleanCsv,
  medicinasInboundCsv,
  medicinasInventoryCsv,
  medicinasProductsCsv,
  nota1CleanCsv,
  nota1FulfillmentCsv,
  nota1OrderItemsCsv,
} from "./csv-export";
import { buildMedicinasCatalog, emptySummary } from "./dedupe";
import { collectManualReviewRows } from "./manual-review";
import { createNota1Order, processNota1Rows } from "./match-nota1";
import { parseWorkbook } from "./parse-workbook";
import type { ImportResult, ImportStrategy } from "./types";

export function runImport(inputPath: string, strategy: ImportStrategy): ImportResult {
  const parsed = parseWorkbook(inputPath);

  const medicinasClassified = processRawRows(parsed.medicinas);
  const medicinasCatalog = buildMedicinasCatalog(medicinasClassified);

  const nota1Classified = processRawRows(parsed.nota1);
  const nota1Processed = processNota1Rows(
    nota1Classified,
    medicinasCatalog.products,
    medicinasCatalog.inventory
  );

  const order = nota1Processed.orderItems.length > 0 ? createNota1Order() : null;
  const manualReview = collectManualReviewRows({
    medicinasRows: medicinasCatalog.classifiedRows,
    nota1Rows: nota1Processed.classifiedRows,
    nota1MatchReasons: nota1Processed.matchReasons,
    ignoredInsumos: parsed.insumos,
    ignoredHoja1: parsed.hoja1,
    orderId: order?.id,
  });

  const activeMedicinas = medicinasCatalog.classifiedRows.filter((row) => !row.skipped);
  const withWarnings = activeMedicinas.filter((row) => row.warnings.length > 0);
  const withoutStock = activeMedicinas.filter((row) => row.quantity === null || row.quantity <= 0);

  const allSlotNumbers = [...medicinasCatalog.slotNumbers];

  const summary = {
    ...emptySummary(),
    productsImported: medicinasCatalog.products.length,
    productsImportedWithWarning: withWarnings.length,
    productsImportedWithoutStock: withoutStock.length,
    productsSkipped: medicinasCatalog.classifiedRows.filter((row) => row.skipped).length,
    slotsCreated: medicinasCatalog.slotNumbers.size,
    initialStockRecords: medicinasCatalog.inventory.length,
    initialInboundTransactions: medicinasCatalog.inboundTransactions.length,
    orderCreated: "NOTA-001",
    orderItemsCreated: nota1Processed.orderItems.length,
    fulfillmentTransactions: nota1Processed.fulfillmentTransactions.length,
    nota1RowsSkipped: nota1Processed.nota1RowsSkipped,
    manualReviewRows: manualReview.length,
    duplicateRowsSkipped: medicinasCatalog.duplicateRowsSkipped,
  };

  return {
    slotNumbers: allSlotNumbers,
    medicinasClean: medicinasCatalog.classifiedRows,
    medicinasProducts: medicinasCatalog.products,
    medicinasInventory: nota1Processed.adjustedInventory,
    medicinasInbound: medicinasCatalog.inboundTransactions,
    nota1Clean: nota1Processed.classifiedRows,
    nota1OrderItems: nota1Processed.orderItems,
    nota1Fulfillment: nota1Processed.fulfillmentTransactions,
    order,
    manualReview,
    ignoredInsumos: parsed.insumos,
    ignoredHoja1: parsed.hoja1,
    summary,
  };
}

export function buildOutputFiles(
  result: ImportResult,
  strategy: ImportStrategy,
  sourceFile: string,
  slotNumbers: string[]
) {
  const sql = buildSeedSql({
    strategy,
    slotNumbers,
    products: result.medicinasProducts,
    inventory: result.medicinasInventory,
    inboundTransactions: result.medicinasInbound,
    order: result.order,
    orderItems: result.nota1OrderItems,
    fulfillmentTransactions: result.nota1Fulfillment,
    sourceFile,
  });

  return {
    sql,
    medicinasClean: medicinasCleanCsv(result.medicinasClean),
    medicinasProducts: medicinasProductsCsv(result.medicinasProducts),
    medicinasInventory: medicinasInventoryCsv(result.medicinasInventory),
    medicinasInbound: medicinasInboundCsv(result.medicinasInbound),
    nota1Clean: nota1CleanCsv(result.nota1Clean),
    nota1OrderItems: nota1OrderItemsCsv(result.nota1OrderItems),
    nota1Fulfillment: nota1FulfillmentCsv(result.nota1Fulfillment),
    manualReview: manualReviewToCsv(result.manualReview),
    ignoredInsumos: ignoredSheetCsv(result.ignoredInsumos),
    ignoredHoja1: ignoredSheetCsv(result.ignoredHoja1),
  };
}

export function printSummary(summary: ImportResult["summary"]): void {
  console.log(`Products imported: ${summary.productsImported}`);
  console.log(`Products imported with warning: ${summary.productsImportedWithWarning}`);
  console.log(`Products imported without stock: ${summary.productsImportedWithoutStock}`);
  console.log(`Products skipped: ${summary.productsSkipped}`);
  console.log(`Slots created: ${summary.slotsCreated}`);
  console.log(`Initial stock records created: ${summary.initialStockRecords}`);
  console.log(`Initial IN transactions created: ${summary.initialInboundTransactions}`);
  console.log(`Order created: ${summary.orderCreated}`);
  console.log(`Order items created from NOTA 1: ${summary.orderItemsCreated}`);
  console.log(`OUT transactions created from NOTA 1: ${summary.fulfillmentTransactions}`);
  console.log(`NOTA 1 rows skipped: ${summary.nota1RowsSkipped}`);
  console.log(`Manual review rows: ${summary.manualReviewRows}`);
  console.log(`Duplicate rows skipped: ${summary.duplicateRowsSkipped}`);
}
