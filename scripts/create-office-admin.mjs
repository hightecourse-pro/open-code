// Creates (or reuses) the office admin user for testing, fully active + admin.
//   node --env-file=.env.local scripts/create-office-admin.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const EMAIL = "office@opencode.org.il";
const PASSWORD = "OpenCode!Admin2026";
const FIRST = "צוות";
const LAST = "קוד פתוח";

let userId;
const { data: created, error } = await sb.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: `${FIRST} ${LAST}` },
});

if (error) {
  const { data: list } = await sb.auth.admin.listUsers();
  userId = list.users.find((u) => u.email === EMAIL)?.id;
  console.log(`ℹ️  user already exists: ${userId} — resetting password + promoting`);
  if (userId) await sb.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
} else {
  userId = created.user.id;
  console.log(`✅ created user: ${userId}`);
}

if (!userId) {
  console.error("Could not resolve user id");
  process.exit(1);
}

const { error: upErr } = await sb
  .from("profiles")
  .update({
    status: "active",
    role: "admin",
    full_name: `${FIRST} ${LAST}`,
    first_name: FIRST,
    last_name: LAST,
    avatar_initials: FIRST.slice(0, 1),
    profile_completed: true,
  })
  .eq("id", userId);
if (upErr) console.log(`   update error: ${upErr.message}`);

const { data: after } = await sb
  .from("profiles")
  .select("status, role")
  .eq("id", userId)
  .single();

if (after?.status === "active" && after?.role === "admin") {
  console.log(`\n🎉 ready — log in at /login with:\n   ${EMAIL}\n   ${PASSWORD}`);
} else {
  console.log(`\n⚠️  status=${after?.status} role=${after?.role} — if blocked, run supabase/migrations/20260615090300_guard_fix.sql and re-run.`);
}
