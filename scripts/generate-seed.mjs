#!/usr/bin/env node
/**
 * Regenerate supabase/seed.sql from the Excel sample.
 * Usage: node scripts/generate-seed.mjs
 */
import { execSync } from "child_process";
import { resolve } from "path";

const script = resolve(process.cwd(), "scripts/_generate-seed.py");
execSync(`python3 "${script}"`, { stdio: "inherit" });
