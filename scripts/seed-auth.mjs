#!/usr/bin/env node
/**
 * Seed auth users for local development.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 * Usage: node scripts/seed-auth.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
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

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  { email: "admin@aid-inventory.local", password: "password123", role: "admin", name: "Admin User" },
  { email: "staff@aid-inventory.local", password: "password123", role: "staff", name: "Staff User" },
  { email: "collaborator@aid-inventory.local", password: "password123", role: "collaborator", name: "Collaborator User" },
];

for (const user of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { role: user.role, name: user.name },
  });

  if (error) {
    console.log(`User ${user.email}: ${error.message}`);
  } else {
    console.log(`Created ${user.email} (${data.user.id})`);
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: "active",
    });
  }
}

console.log("Done.");
