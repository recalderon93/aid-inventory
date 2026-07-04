#!/usr/bin/env node
/**
 * Seed auth users for local development.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 * Usage: node scripts/seed-auth.mjs
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[match[1].trim()] = value;
      }
    }
  } catch {
    // ignore
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL looks invalid. Use only the Project URL, e.g. https://abcdefgh.supabase.co"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

const users = [
  { email: "admin@aid-inventory.local", password: "password123", role: "admin", name: "Admin User" },
  { email: "staff@aid-inventory.local", password: "password123", role: "staff", name: "Staff User" },
  { email: "collaborator@aid-inventory.local", password: "password123", role: "collaborator", name: "Collaborator User" },
];

async function upsertProfile(supabase, row) {
  const { error } = await supabase.from("profiles").upsert(row);
  if (!error) return true;

  // Fallback when migration 00014 (first_name, last_name) is not applied yet.
  const { first_name: _f, last_name: _l, ...base } = row;
  const { error: fallbackError } = await supabase.from("profiles").upsert(base);
  if (fallbackError) {
    console.error(`Profile upsert failed for ${row.email}:`, fallbackError.message);
    return false;
  }
  return true;
}

for (const user of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { role: user.role, name: user.name },
  });

  const [firstName, ...rest] = user.name.split(" ");
  const lastName = rest.join(" ") || "";

  if (error) {
    console.log(`User ${user.email}: ${error.message}`);
    const { data: listed } = await supabase.auth.admin.listUsers();
    const existing = listed?.users?.find((u) => u.email === user.email);
    if (existing) {
      const ok = await upsertProfile(supabase, {
        id: existing.id,
        email: user.email,
        name: user.name,
        first_name: firstName,
        last_name: lastName,
        role: user.role,
        status: "active",
      });
      console.log(ok ? `Ensured profile for ${user.email}` : `Failed profile for ${user.email}`);
    }
  } else {
    console.log(`Created ${user.email} (${data.user.id})`);
    const ok = await upsertProfile(supabase, {
      id: data.user.id,
      email: user.email,
      name: user.name,
      first_name: firstName,
      last_name: lastName,
      role: user.role,
      status: "active",
    });
    if (!ok) console.error(`Failed profile for ${user.email}`);
  }
}

console.log("Done.");
