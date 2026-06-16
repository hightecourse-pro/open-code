// Verifies the Phase 1 schema applied. Run with:
//   node --env-file=.env.local scripts/check-db.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "profiles",
  "mentor_profiles",
  "mentorships",
  "subscriptions",
  "payments",
  "config_questions",
  "config_taxonomies",
  "profile_answers",
  "posts",
  "comments",
  "reactions",
  "reports",
];

let ok = 0;
for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`❌ ${t.padEnd(20)} ${error.message}`);
  } else {
    console.log(`✅ ${t.padEnd(20)} ${count} rows`);
    ok++;
  }
}

console.log(`\n${ok}/${tables.length} tables present.`);
process.exit(ok === tables.length ? 0 : 1);
