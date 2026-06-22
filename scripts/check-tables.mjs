// Read-only: which tables exist + row counts. Tells us if Phase 2/3 is applied.
//   node --env-file=.env.local scripts/check-tables.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tables = [
  "profiles", "posts", "subscriptions", "app_settings", // phase 1
  "jobs", "courses", "recordings", "sessions", "enrollments", "applications", "conversations", "messages", // phase 2
  "cv_reviews", "interview_sessions", "user_ai_keys", // phase 3
];

for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(20)} ${error ? "❌ " + error.message.slice(0, 40) : "✓ rows=" + count}`);
}
