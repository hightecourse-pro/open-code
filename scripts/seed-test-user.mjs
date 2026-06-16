// Creates (or reuses) a test admin user and promotes her to active+admin.
// Verifies the on_auth_user_created trigger and the guard-column fix.
//   node --env-file=.env.local scripts/seed-test-user.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const EMAIL = "admin@opencode.test";
const PASSWORD = "opencode1234";

let userId;
const { data: created, error } = await sb.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "אדמין בדיקה" },
});

if (error) {
  const { data: list } = await sb.auth.admin.listUsers();
  userId = list.users.find((u) => u.email === EMAIL)?.id;
  console.log(`ℹ️  user already exists: ${userId}`);
} else {
  userId = created.user.id;
  console.log(`✅ created user: ${userId}`);
}

if (!userId) {
  console.error("Could not resolve user id");
  process.exit(1);
}

const { data: before } = await sb.from("profiles").select("status, role").eq("id", userId).single();
console.log(`   profile created by trigger → status=${before?.status} role=${before?.role}`);

const { error: upErr } = await sb
  .from("profiles")
  .update({ status: "active", role: "admin", specialization: "פולסטאק", region: "מרכז", avatar_initials: "א" })
  .eq("id", userId);
if (upErr) console.log(`   update error: ${upErr.message}`);

const { data: after } = await sb.from("profiles").select("status, role").eq("id", userId).single();
console.log(`   after promote     → status=${after?.status} role=${after?.role}`);

if (after?.status === "active" && after?.role === "admin") {
  console.log(`\n🎉 ready — log in at /login with:\n   ${EMAIL}\n   ${PASSWORD}`);
} else {
  console.log(`\n⚠️  guard still blocking — run supabase/migrations/20260615090300_guard_fix.sql, then re-run this script.`);
}
