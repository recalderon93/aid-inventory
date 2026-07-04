#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCleanImportSql } from "./lib/import/build-clean-import-sql";
import { runCleanImport } from "./lib/import/clean-csv-import";
import type { ImportStrategy } from "./lib/import/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_SEED_DIR = path.join(ROOT, "supabase/seed");

function parseArgs(argv: string[]) {
  let seedDir = DEFAULT_SEED_DIR;
  let strategy: ImportStrategy = "upsert";
  let dryRun = false;

  const files = {
    clean: path.join(seedDir, "medicinas_clean_updated.csv"),
    manualReview: path.join(seedDir, "manual_review_remaining_updated.csv"),
    consolidation: path.join(seedDir, "duplicate_consolidation_log.csv"),
    nota1: path.join(seedDir, "nota1_clean.csv"),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed-dir" && argv[i + 1]) {
      seedDir = path.resolve(argv[++i]!);
      files.clean = path.join(seedDir, "medicinas_clean_updated.csv");
      files.manualReview = path.join(seedDir, "manual_review_remaining_updated.csv");
      files.consolidation = path.join(seedDir, "duplicate_consolidation_log.csv");
      files.nota1 = path.join(seedDir, "nota1_clean.csv");
    } else if (arg === "--strategy" && argv[i + 1]) {
      const value = argv[++i]!;
      if (value !== "fresh" && value !== "upsert") {
        throw new Error(`Invalid strategy: ${value}. Use fresh or upsert.`);
      }
      strategy = value;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run import:clean -- [options]

Options:
  --seed-dir <path>       Directory with final CSV files (default: supabase/seed)
  --strategy fresh|upsert SQL generation strategy (default: upsert)
  --dry-run               Parse and summarize without writing files
`);
      process.exit(0);
    }
  }

  return { seedDir, strategy, dryRun, files };
}

function printSummary(summary: ReturnType<typeof runCleanImport>["summary"], nota1Available: boolean) {
  console.log(`Products imported/upserted: ${summary.productsImported}`);
  console.log(`Stock records created/updated: ${summary.stockRecords}`);
  console.log(`IN transactions created: ${summary.inboundTransactions}`);
  console.log(`Manual review records created: ${summary.manualReviewRecords}`);
  console.log(`Duplicate consolidation audit records created: ${summary.consolidationAuditRecords}`);
  console.log(
    `Rows ignored from Hoja1/INSUMOS: ${summary.rowsIgnoredFromHoja1Insumos} (final import uses only cleaned CSV files)`
  );
  console.log(`Order NOTA-001 created: ${summary.orderNota001Created ? "yes" : "no"}`);
  console.log(`Order items created: ${summary.orderItemsCreated}`);
  console.log(`Warnings: ${summary.warnings}`);

  if (!nota1Available) {
    console.log(
      "\nTODO: NOTA 1 order items require nota1_clean.csv in the seed directory. Copy from a previous import run or provide the delivery-note CSV."
    );
  }
}

function main() {
  const { seedDir, strategy, dryRun, files } = parseArgs(process.argv.slice(2));

  for (const [label, filePath] of Object.entries({
    medicinas_clean_updated: files.clean,
    manual_review_remaining_updated: files.manualReview,
    duplicate_consolidation_log: files.consolidation,
  })) {
    if (!existsSync(filePath)) {
      throw new Error(`Missing required file: ${filePath} (${label})`);
    }
  }

  const nota1Available = existsSync(files.nota1);
  console.log(`Reading clean inventory from ${files.clean}`);
  console.log(`Reading manual review from ${files.manualReview}`);
  console.log(`Reading consolidation log from ${files.consolidation}`);
  if (nota1Available) {
    console.log(`Reading NOTA 1 from ${files.nota1}`);
  }

  const result = runCleanImport({
    cleanCsvPath: files.clean,
    manualReviewCsvPath: files.manualReview,
    consolidationLogPath: files.consolidation,
    nota1CleanPath: nota1Available ? files.nota1 : null,
  });

  printSummary(result.summary, nota1Available);

  if (dryRun) {
    console.log("\nDry run — no files written.");
    return;
  }

  const sql = buildCleanImportSql({
    strategy,
    slotNumbers: result.slotNumbers,
    products: result.products,
    inventory: result.inventory,
    inboundTransactions: result.inboundTransactions,
    order: result.order,
    orderItems: result.orderItems,
    fulfillmentTransactions: result.fulfillmentTransactions,
    reviewItems: result.reviewItems,
    auditLogs: result.auditLogs,
    productsNeedingReview: result.productsNeedingReview,
  });

  mkdirSync(seedDir, { recursive: true });
  const sqlPath = path.join(seedDir, "001_import_clean_inventory.sql");
  writeFileSync(sqlPath, sql, "utf8");
  console.log(`\nWrote ${sqlPath}`);
}

main();
