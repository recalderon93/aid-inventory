import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load KEY=VALUE pairs from a dotenv file into process.env (no override). */
export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

export function loadEnvFromArg(envArg) {
  const root = resolve(import.meta.dirname, "../..");
  if (envArg) {
    return loadEnvFile(resolve(envArg));
  }
  loadEnvFile(resolve(root, ".env.production.local"));
  loadEnvFile(resolve(root, ".env.local"));
}

/** Load env file and override existing process.env values. */
export function loadEnvFileOverride(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}
