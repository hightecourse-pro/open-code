// Fixtures for verifying the membership-model build on staging:
//   * a paid test member (subscription active) for the cancel/resume flow
//   * a pending mentor applicant (questionnaire "done") for the approval queue
//   * a published session ~25 minutes out for the reminders endpoint
// All addresses are @opencode.test — never allowlisted, so no real mail moves.
//   node --env-file=.env.local scripts/seed-membership-verify.mjs
import { guardTarget } from "./_guard.mjs";
import { createClient } from "@supabase/supabase-js";

guardTarget();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const PASS = process.env.VERIFY_FIXTURE_PASSWORD;
if (!PASS) { console.error("set VERIFY_FIXTURE_PASSWORD"); process.exit(1); }

async function ensureUser(email, name) {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    await sb.auth.admin.updateUserById(existing.id, { password: PASS });
    return existing.id;
  }
  const { data: created, error } = await sb.auth.admin.createUser({
    email, password: PASS, email_confirm: true, user_metadata: { full_name: name },
  });
  if (error) { console.error("create failed:", email, error.message); process.exit(1); }
  return created.user.id;
}

// 1. paid member
const payerId = await ensureUser("sub.test@opencode.test", "מנויה בדיקה");
await sb.from("profiles").update({
  full_name: "מנויה בדיקה", role: "junior", member_tier: "paid", status: "active",
  profile_completed: true, avatar_initials: "מב",
}).eq("id", payerId);
const { data: sub } = await sb.from("subscriptions").select("id").eq("profile_id", payerId).maybeSingle();
const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + 1);
if (sub) {
  await sb.from("subscriptions").update({ status: "active", plan: "monthly", canceled_at: null, current_period_end: periodEnd.toISOString() }).eq("id", sub.id);
} else {
  await sb.from("subscriptions").insert({
    profile_id: payerId, plan: "monthly", status: "active", provider: "nedarim",
    min_term_months: 0, current_period_end: periodEnd.toISOString(),
  });
}
console.log("payer:", payerId);

// 2. pending mentor applicant (as if she clicked the join button + filled up)
const mentorId = await ensureUser("mentor.test@opencode.test", "מנטורית בדיקה");
await sb.from("profiles").update({
  full_name: "מנטורית בדיקה", role: "mentor", member_tier: "free", status: "pending",
  profile_completed: true, avatar_initials: "מב", specialization: "פולסטאק",
}).eq("id", mentorId);
// a couple of mentor answers so the public spotlight has content
const { data: qs } = await sb.from("config_questions").select("id, key").in("key", ["mentor_workplace", "mentor_years", "mentor_tech", "mentor_contribution"]);
const byKey = new Map((qs ?? []).map((q) => [q.key, q.id]));
const answers = [
  { key: "mentor_workplace", value: "חברת הייטק לדוגמה" },
  { key: "mentor_years", value: 7 },
  { key: "mentor_contribution", value: ["answers", "mental"] },
];
for (const a of answers) {
  const qid = byKey.get(a.key);
  if (!qid) continue;
  await sb.from("profile_answers").delete().eq("profile_id", mentorId).eq("question_id", qid);
  await sb.from("profile_answers").insert({ profile_id: mentorId, question_id: qid, value: a.value });
}
console.log("mentor applicant:", mentorId);

// 3. session ~25 minutes from now (t30 window) for the reminders check
await sb.from("sessions").delete().eq("title", "סשן בדיקת תזכורות");
const at = new Date(Date.now() + 25 * 60 * 1000);
const { data: ses, error: sesErr } = await sb.from("sessions").insert({
  title: "סשן בדיקת תזכורות", topic: "בדיקה", scheduled_at: at.toISOString(),
  zoom_url: "https://zoom.us/j/000-verify", is_published: true, status: "scheduled",
}).select("id").single();
console.log("session:", sesErr ? "ERR " + sesErr.message : ses.id);
