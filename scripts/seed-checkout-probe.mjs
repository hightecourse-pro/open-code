// A throwaway PENDING member so the checkout page can be inspected.
//   node --env-file=.env.local scripts/seed-checkout-probe.mjs
import { guardTarget } from "./_guard.mjs";
import { createClient } from "@supabase/supabase-js";

guardTarget();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const PASS = process.env.VERIFY_FIXTURE_PASSWORD;
if (!PASS) { console.error("set VERIFY_FIXTURE_PASSWORD"); process.exit(1); }

const EMAIL = "checkout.probe@opencode.test";
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
let id = list?.users?.find((u) => u.email === EMAIL)?.id;
if (id) {
  await sb.auth.admin.updateUserById(id, { password: PASS });
} else {
  const { data: created, error } = await sb.auth.admin.createUser({
    email: EMAIL, password: PASS, email_confirm: true, user_metadata: { full_name: "בודקת צ'ק-אאוט" },
  });
  if (error) { console.error(error.message); process.exit(1); }
  id = created.user.id;
}
await sb.from("profiles").update({ status: "pending", role: "junior", member_tier: "paid", profile_completed: true }).eq("id", id);
console.log("probe user:", id);
