// Creates a confirmed member left at status=pending (paid tier), so you can
// log in and reach the /join checkout without email confirmation.
//   node --env-file=.env.local scripts/seed-pending-member.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL = "member@opencode.test";
const PASSWORD = "opencode1234";

const { data, error } = await sb.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "נועה רצון" },
});

let uid;
if (error) {
  const { data: list } = await sb.auth.admin.listUsers();
  uid = list.users.find((u) => u.email === EMAIL)?.id;
  console.log(`ℹ️  member already exists: ${uid}`);
} else {
  uid = data.user.id;
  console.log(`✅ created member: ${uid}`);
}

// Ensure she's pending + paid tier (the trigger already defaults to this).
await sb.from("profiles").update({ status: "pending", member_tier: "paid" }).eq("id", uid);
const { data: p } = await sb.from("profiles").select("status, member_tier").eq("id", uid).single();

console.log(`profile → status=${p?.status} tier=${p?.member_tier}`);
console.log(`\n🎯 log in at /login with:\n   ${EMAIL}\n   ${PASSWORD}\n   → you'll land on /join (checkout).`);
