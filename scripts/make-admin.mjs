// Promotes a user (by email) to admin + active.
//   node --env-file=.env.local scripts/make-admin.mjs someone@example.com
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2] || "saraavi.ezra@gmail.com";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: list } = await sb.auth.admin.listUsers();
const user = list?.users.find((u) => u.email === email);
if (!user) {
  console.log(`❌ no user with email ${email}`);
  process.exit(1);
}

const { error } = await sb
  .from("profiles")
  .update({ role: "admin", status: "active" })
  .eq("id", user.id);

const { data: p } = await sb.from("profiles").select("role, status").eq("id", user.id).single();
console.log(error ? `❌ ${error.message}` : `✅ ${email} → role=${p?.role} status=${p?.status}`);
