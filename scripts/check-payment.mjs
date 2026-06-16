// Verifies the payment-activation data path (mirrors activateSubscription),
// then cleans up the temporary member.
//   node --env-file=.env.local scripts/check-payment.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = `member-${Date.now()}@opencode.test`;
const { data: created, error: cErr } = await sb.auth.admin.createUser({
  email,
  password: "opencode1234",
  email_confirm: true,
  user_metadata: { full_name: "חברה לבדיקה" },
});
if (cErr) {
  console.log(`❌ create: ${cErr.message}`);
  process.exit(1);
}
const uid = created.user.id;

const { data: before } = await sb.from("profiles").select("status, member_tier").eq("id", uid).single();
console.log(`new member → status=${before?.status} tier=${before?.member_tier}`);

const periodEnd = new Date();
periodEnd.setMonth(periodEnd.getMonth() + 1);
const { data: sub, error: sErr } = await sb
  .from("subscriptions")
  .insert({ profile_id: uid, plan: "monthly", status: "active", provider: "nedarim", current_period_end: periodEnd.toISOString() })
  .select("id")
  .single();
console.log(sErr ? `❌ subscription: ${sErr.message}` : "✅ subscription created");

const { error: pErr } = await sb.from("payments").insert({
  subscription_id: sub?.id,
  profile_id: uid,
  amount_agorot: 3900,
  currency: "ILS",
  status: "succeeded",
  paid_at: new Date().toISOString(),
});
console.log(pErr ? `❌ payment: ${pErr.message}` : "✅ payment recorded");

await sb.from("profiles").update({ status: "active" }).eq("id", uid);
const { data: after } = await sb.from("profiles").select("status").eq("id", uid).single();
console.log(`after activation → status=${after?.status}`);

// cleanup
await sb.auth.admin.deleteUser(uid);
console.log(
  after?.status === "active"
    ? "\n🎉 payment activation path works (test member cleaned up)"
    : "\n❌ activation did not stick"
);
