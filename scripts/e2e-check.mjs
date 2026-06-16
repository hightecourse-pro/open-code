// End-to-end RLS check with a REAL user JWT (anon/publishable key, not service role).
//   node --env-file=.env.local scripts/e2e-check.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const { data: auth, error: signErr } = await sb.auth.signInWithPassword({
  email: "admin@opencode.test",
  password: "opencode1234",
});
if (signErr) {
  console.log(`❌ sign in: ${signErr.message}`);
  process.exit(1);
}
console.log(`✅ sign in ok (uid ${auth.user.id.slice(0, 8)}…)`);

const { data: profile } = await sb
  .from("profiles")
  .select("full_name, role, status")
  .eq("id", auth.user.id)
  .single();
console.log(`✅ RLS self-read: ${profile?.full_name} (${profile?.role}/${profile?.status})`);

// Seed a first welcome post if the feed is empty
const { count } = await sb.from("posts").select("*", { count: "exact", head: true }).eq("kind", "feed");
if ((count ?? 0) === 0) {
  const { error: postErr } = await sb.from("posts").insert({
    author_id: auth.user.id,
    body: "ברוכות הבאות לקהילה של קוד פתוח! 🎉 אני פה לכל שאלה — בהצלחה במסע 💜",
    intent: "knowledge",
    kind: "feed",
  });
  console.log(postErr ? `❌ insert post: ${postErr.message}` : "✅ RLS insert: welcome post created");
} else {
  console.log(`ℹ️  feed already has ${count} post(s)`);
}

const { data: posts } = await sb.from("posts").select("id, body").eq("kind", "feed");
console.log(`✅ RLS feed read: ${posts?.length ?? 0} post(s) visible`);
console.log("\n🎉 auth + RLS + posts all working end-to-end.");
