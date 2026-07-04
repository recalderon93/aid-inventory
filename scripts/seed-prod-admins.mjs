#!/usr/bin/env node
/**
 * Create or update production admin users.
 * Credentials are passed via environment variables — never commit passwords.
 *
 * Usage:
 *   ADMIN1_EMAIL=... ADMIN1_PASSWORD=... ADMIN1_FIRST_NAME=... ADMIN1_LAST_NAME=... ADMIN1_PHONE=... \
 *   ADMIN2_EMAIL=... ADMIN2_PASSWORD=... ADMIN2_FIRST_NAME=... ADMIN2_LAST_NAME=... ADMIN2_PHONE=... \
 *   node scripts/seed-prod-admins.mjs --env .env.production.local
 */
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { loadEnvFromArg } from "./lib/load-env.mjs";

function parseArgs(argv) {
  let envFile = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--env" && argv[i + 1]) envFile = argv[++i];
  }
  return { envFile };
}

function adminsFromEnv() {
  const admins = [];
  for (const n of [1, 2, 3, 4, 5]) {
    const email = process.env[`ADMIN${n}_EMAIL`];
    const password = process.env[`ADMIN${n}_PASSWORD`];
    if (!email || !password) continue;
    admins.push({
      email,
      password,
      first_name: process.env[`ADMIN${n}_FIRST_NAME`] ?? "",
      last_name: process.env[`ADMIN${n}_LAST_NAME`] ?? "",
      phone: process.env[`ADMIN${n}_PHONE`] ?? null,
      role: "admin",
    });
  }
  return admins;
}

async function upsertProfile(supabase, row) {
  const name = `${row.first_name} ${row.last_name}`.trim() || row.email;
  const payload = {
    id: row.id,
    email: row.email,
    name,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    phone: row.phone,
    role: row.role,
    status: "active",
  };
  const { error } = await supabase.from("profiles").upsert(payload);
  if (!error) return true;

  const { first_name: _f, last_name: _l, phone: _p, ...base } = payload;
  const { error: fallbackError } = await supabase.from("profiles").upsert(base);
  if (fallbackError) {
    console.error(`Profile upsert failed for ${row.email}:`, fallbackError.message);
    return false;
  }
  return true;
}

async function ensureAdmin(supabase, admin) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: admin.email,
    password: admin.password,
    email_confirm: true,
    user_metadata: {
      role: admin.role,
      name: `${admin.first_name} ${admin.last_name}`.trim(),
    },
  });

  if (!error && data?.user) {
    console.log(`Created ${admin.email}`);
    await upsertProfile(supabase, { ...admin, id: data.user.id });
    return;
  }

  const { data: listed } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === admin.email.toLowerCase());
  if (!existing) {
    console.error(`Failed ${admin.email}: ${error?.message ?? "unknown error"}`);
    return;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password: admin.password,
    email_confirm: true,
    user_metadata: {
      role: admin.role,
      name: `${admin.first_name} ${admin.last_name}`.trim(),
    },
  });
  if (updateError) {
    console.error(`Update auth failed for ${admin.email}:`, updateError.message);
  } else {
    console.log(`Updated auth for ${admin.email}`);
  }

  await upsertProfile(supabase, { ...admin, id: existing.id });
}

async function main() {
  const { envFile } = parseArgs(process.argv.slice(2));
  loadEnvFromArg(envFile);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admins = adminsFromEnv();
  if (admins.length === 0) {
    console.error("Set ADMIN1_EMAIL, ADMIN1_PASSWORD, etc. in the environment.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });

  for (const admin of admins) {
    await ensureAdmin(supabase, admin);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
