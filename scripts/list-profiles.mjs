// Lists all profiles with their auth email, role and status.
//   node --env-file=.env.local scripts/list-profiles.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: profiles } = await sb
  .from("profiles")
  .select("id, full_name, role, status, member_tier")
  .order("created_at", { ascending: true });

const { data: list } = await sb.auth.admin.listUsers();
const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email]));

console.log("email".padEnd(30), "role".padEnd(8), "status".padEnd(10), "tier");
console.log("-".repeat(60));
for (const p of profiles ?? []) {
  console.log(
    (emailById.get(p.id) ?? "?").padEnd(30),
    p.role.padEnd(8),
    p.status.padEnd(10),
    p.member_tier
  );
}
