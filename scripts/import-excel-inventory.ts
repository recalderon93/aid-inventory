#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildOutputFiles, printSummary, runImport } from "./lib/import/pipeline";
import type { ImportStrategy } from "./lib/import/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "docs/samples/INVENTARIO MEDICINAS CARITAS V3.xlsx");
const DEFAULT_OUT_DIR = path.join(ROOT, "supabase/seed");

function parseArgs(argv: string[]) {
  let input = DEFAULT_INPUT;
  let outDir = DEFAULT_OUT_DIR;
  let strategy: ImportStrategy = "upsert";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      input = path.resolve(argv[++i]!);
    } else if (arg === "--out-dir" && argv[i + 1]) {
      outDir = path.resolve(argv[++i]!);
    } else if (arg === "--strategy" && argv[i + 1]) {
      const value = argv[++i]!;
      if (value !== "fresh" && value !== "upsert") {
        throw new Error(`Invalid strategy: ${value}. Use fresh or upsert.`);
      }
      strategy = value;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run import:inventory -- [options]

Options:
  --input <path>       Excel workbook path (default: docs/samples/INVENTARIO MEDICINAS CARITAS V3.xlsx)
  --out-dir <path>     Output directory (default: supabase/seed)
  --strategy fresh|upsert   SQL generation strategy (default: upsert)
  --dry-run            Parse and summarize without writing files
`);
      process.exit(0);
    }
  }

  return { input, outDir, strategy, dryRun };
}

function main() {
  const { input, outDir, strategy, dryRun } = parseArgs(process.argv.slice(2));
  console.log(`Reading ${input}`);
  const result = runImport(input, strategy);
  printSummary(result.summary);

  if (dryRun) {
    console.log("\nDry run — no files written.");
    return;
  }

  const files = buildOutputFiles(result, strategy, path.basename(input), result.slotNumbers);
  mkdirSync(outDir, { recursive: true });

  const outputs: Record<string, string> = {
    "001_import_excel_inventory.sql": files.sql,
    "manual_review_rows.csv": files.manualReview,
    "medicinas_clean.csv": files.medicinasClean,
    "medicinas_products.csv": files.medicinasProducts,
    "medicinas_inventory.csv": files.medicinasInventory,
    "medicinas_inbound_transactions.csv": files.medicinasInbound,
    "nota1_clean.csv": files.nota1Clean,
    "nota1_order_items.csv": files.nota1OrderItems,
    "nota1_fulfillment_transactions.csv": files.nota1Fulfillment,
    "ignored_insumos.csv": files.ignoredInsumos,
    "ignored_hoja1.csv": files.ignoredHoja1,
  };

  for (const [filename, content] of Object.entries(outputs)) {
    const target = path.join(outDir, filename);
    writeFileSync(target, content, "utf8");
    console.log(`Wrote ${target}`);
  }
}

main();
