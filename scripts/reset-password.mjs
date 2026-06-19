// Resets a user's password and confirms their email (admin).
//   node --env-file=.env.local scripts/reset-password.mjs <email> <password>
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = process.argv[2] || "saraavi.ezra@gmail.com";
const password = process.argv[3] || "Opencode!2026";

const { data: list } = await sb.auth.admin.listUsers();
const user = list?.users.find((u) => u.email === email);
if (!user) {
  console.log(`❌ no user with email ${email}`);
  process.exit(1);
}

const { error } = await sb.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
});
console.log(error ? `❌ ${error.message}` : `✅ ${email}\n   password = ${password}\n   email confirmed ✓`);
