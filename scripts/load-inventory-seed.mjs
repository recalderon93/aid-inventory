#!/usr/bin/env node
/**
 * Phase 2 loader — applies generated seed SQL to Supabase.
 * NOT run automatically. Requires explicit --confirm flag.
 *
 * Usage:
 *   node scripts/load-inventory-seed.mjs --target dev --strategy upsert --confirm
 *   node scripts/load-inventory-seed.mjs --target prod --strategy upsert --confirm
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_SQL = path.join(ROOT, "supabase/seed/001_import_clean_inventory.sql");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  let target = "dev";
  let strategy = "upsert";
  let sqlFile = DEFAULT_SQL;
  let confirm = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target" && argv[i + 1]) target = argv[++i];
    else if (arg === "--strategy" && argv[i + 1]) strategy = argv[++i];
    else if (arg === "--sql" && argv[i + 1]) sqlFile = path.resolve(argv[++i]);
    else if (arg === "--confirm") confirm = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/load-inventory-seed.mjs [options]

Options:
  --target dev|prod     Target environment label (default: dev)
  --strategy upsert|fresh   Regenerate SQL with matching strategy before load
  --sql <path>          SQL file to execute (default: supabase/seed/001_import_clean_inventory.sql)
  --confirm             Required to execute against any target

Apply migration 00016_import_review.sql before loading. Review pending items in /import-review after load.
`);
      process.exit(0);
    }
  }

  return { target, strategy, sqlFile, confirm };
}

function main() {
  const { target, strategy, sqlFile, confirm } = parseArgs(process.argv.slice(2));

  if (!confirm) {
    console.error(
      "Refusing to load without --confirm. Apply migration 00016 and review import review items after load."
    );
    process.exit(1);
  }

  if (!existsSync(sqlFile)) {
    console.error(`SQL file not found: ${sqlFile}`);
    console.error("Run: npm run import:clean");
    process.exit(1);
  }

  const env = {
    ...loadEnvFile(path.join(ROOT, ".env.local")),
    ...process.env,
  };

  const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "Missing SUPABASE_DB_URL or DATABASE_URL in .env.local.\n" +
        "Add a Postgres connection string, or apply the SQL manually in Supabase SQL editor."
    );
    process.exit(1);
  }

  console.log(`Target: ${target}`);
  console.log(`Strategy: ${strategy}`);
  console.log(`SQL: ${sqlFile}`);
  console.log("Applying seed SQL...");

  execSync(`psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${sqlFile}"`, {
    stdio: "inherit",
    env,
  });

  console.log("Load complete.");
}

main();
