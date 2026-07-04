#!/usr/bin/env node
/**
 * Execute SQL file(s) against Postgres using SUPABASE_DB_URL or DATABASE_URL.
 *
 * Usage:
 *   node scripts/run-sql.mjs --env .env.production.local supabase/migrations/00016_import_review.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { loadEnvFromArg } from "./lib/load-env.mjs";

const { Client } = pg;

function parseArgs(argv) {
  let envFile = null;
  const files = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env" && argv[i + 1]) {
      envFile = resolve(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/run-sql.mjs [--env <path>] <file.sql> [more.sql...]`);
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      files.push(resolve(arg));
    }
  }

  return { envFile, files };
}

async function main() {
  const { envFile, files } = parseArgs(process.argv.slice(2));
  if (files.length === 0) {
    console.error("Provide at least one .sql file.");
    process.exit(1);
  }

  loadEnvFromArg(envFile);
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL or DATABASE_URL.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const file of files) {
      if (!existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }
      const sql = readFileSync(file, "utf8");
      console.log(`Executing ${file}...`);
      await client.query(sql);
      console.log(`Done: ${file}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
