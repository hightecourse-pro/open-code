// Read-only: did any subscription/payment get recorded, and member statuses.
//   node --env-file=.env.local scripts/check-payments-state.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: subs } = await sb.from("subscriptions").select("*");
console.log(`subscriptions: ${subs?.length ?? 0}`);
for (const s of subs ?? []) console.log("  ", JSON.stringify(s));

const { data: pays } = await sb.from("payments").select("*");
console.log(`payments: ${pays?.length ?? 0}`);
for (const p of pays ?? []) console.log("  ", JSON.stringify(p));

const { data: profiles } = await sb.from("profiles").select("id, status, member_tier, created_at");
const { data: list } = await sb.auth.admin.listUsers();
const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email]));
console.log("profiles:");
for (const p of profiles ?? []) {
  console.log(`   ${(emailById.get(p.id) ?? p.id).padEnd(34)} status=${p.status} tier=${p.member_tier}`);
}