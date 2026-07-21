// Seeds a complete, idempotent QA fixture for the employer portal:
//   * a portal client (username/password below)
//   * a listed test candidate (active + junior + completed + portal_listed)
//   * an open job linked to the client, with the candidate curated onto it
// Writes e2e/.auth/portal-qa.json for e2e/portal-flow.spec.ts to consume.
//   node --env-file=.env.local scripts/seed-portal-qa.mjs
// Cleanup: node --env-file=.env.local scripts/seed-portal-qa.mjs --cleanup
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes, scryptSync } from "crypto";
import fs from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const CLIENT_USERNAME = "e2e-qa-client";
const CLIENT_PASSWORD = "qa-e2e-portal-2026";
const CLIENT_COMPANY = "חברת בדיקה E2E";
const CANDIDATE_EMAIL = "candidate-e2e@opencode.test";
const CANDIDATE_NAME = "מועמדת בדיקה E2E";
const JOB_TITLE = "משרת בדיקה E2E (פורטל)";

// Mirror src/lib/ai/crypto.ts exactly so the app can decrypt what we store.
const SECRET = process.env.AI_KEY_SECRET || "opencode-dev-insecure-secret-change-me";
const KEY = scryptSync(SECRET, "opencode-ai-keys-v1", 32);
function encryptSecret(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

async function findCandidateUserId() {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  return list?.users?.find((u) => u.email === CANDIDATE_EMAIL)?.id ?? null;
}

if (process.argv.includes("--cleanup")) {
  // Remove everything the seed created, in dependency order.
  const { data: client } = await sb.from("portal_clients").select("id").eq("username", CLIENT_USERNAME).maybeSingle();
  if (client) {
    await sb.from("portal_favorites").delete().eq("client_id", client.id);
    await sb.from("jobs").delete().eq("client_id", client.id); // cascades job_candidates
    await sb.from("portal_clients").delete().eq("id", client.id);
    console.log("✅ portal client + job removed");
  }
  const userId = await findCandidateUserId();
  if (userId) {
    await sb.auth.admin.deleteUser(userId); // cascades profile via FK
    console.log("✅ test candidate removed");
  }
  console.log("🧹 cleanup done");
  process.exit(0);
}

// 1. Portal client -----------------------------------------------------------
const password_enc = encryptSecret(CLIENT_PASSWORD);
let { data: client } = await sb.from("portal_clients").select("id").eq("username", CLIENT_USERNAME).maybeSingle();
if (client) {
  await sb.from("portal_clients").update({ password_enc, is_active: true, contact_email: "qa-portal@opencode.test" }).eq("id", client.id);
  console.log(`ℹ️  portal client exists: ${client.id} (password refreshed)`);
} else {
  const { data: inserted, error } = await sb
    .from("portal_clients")
    .insert({
      company_name: CLIENT_COMPANY,
      username: CLIENT_USERNAME,
      password_enc,
      contact_email: "qa-portal@opencode.test",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) { console.error("client insert failed:", error.message); process.exit(1); }
  client = inserted;
  console.log(`✅ portal client created: ${client.id}`);
}

// 2. Test candidate ----------------------------------------------------------
let profileId = await findCandidateUserId();
if (!profileId) {
  const { data: created, error } = await sb.auth.admin.createUser({
    email: CANDIDATE_EMAIL,
    password: "e2e-cand-1234",
    email_confirm: true,
    user_metadata: { full_name: CANDIDATE_NAME },
  });
  if (error) { console.error("candidate create failed:", error.message); process.exit(1); }
  profileId = created.user.id;
  console.log(`✅ candidate user created: ${profileId}`);
} else {
  console.log(`ℹ️  candidate exists: ${profileId}`);
}
const { error: profErr } = await sb
  .from("profiles")
  .update({
    full_name: CANDIDATE_NAME,
    status: "active",
    role: "junior",
    profile_completed: true,
    portal_listed: true,
    specialization: "פרונטאנד",
    region: "מרכז",
    bio: "פרופיל בדיקה אוטומטי של מערכת ה-QA. לא מועמדת אמיתית.",
    is_experienced: false,
    avatar_initials: "מב",
  })
  .eq("id", profileId);
if (profErr) { console.error("profile update failed:", profErr.message); process.exit(1); }
console.log("   profile promoted to listed candidate");

// A visible answer so the profile/catalogue have real data (best effort).
const { data: q } = await sb
  .from("config_questions")
  .select("id, key, field_type")
  .eq("employer_visible", true)
  .in("field_type", ["tags", "multiselect"])
  .limit(1)
  .maybeSingle();
if (q) {
  await sb.from("profile_answers").delete().eq("profile_id", profileId).eq("question_id", q.id);
  const { error: ansErr } = await sb
    .from("profile_answers")
    .insert({ profile_id: profileId, question_id: q.id, value: ["React", "TypeScript"] });
  console.log(ansErr ? `   answer skip (${ansErr.message})` : `   answer set for ${q.key}`);
}

// 3. Job linked to the client, candidate curated -----------------------------
let { data: job } = await sb.from("jobs").select("id").eq("title", JOB_TITLE).maybeSingle();
if (job) {
  await sb.from("jobs").update({ client_id: client.id, status: "open" }).eq("id", job.id);
  console.log(`ℹ️  job exists: ${job.id}`);
} else {
  const { data: inserted, error } = await sb
    .from("jobs")
    .insert({
      company: CLIENT_COMPANY,
      title: JOB_TITLE,
      source: "ours",
      employment_type: "full",
      status: "open",
      description: "משרת בדיקה אוטומטית של מערכת ה-QA.",
      tech_tags: ["react"],
      client_id: client.id,
    })
    .select("id")
    .single();
  if (error) { console.error("job insert failed:", error.message); process.exit(1); }
  job = inserted;
  console.log(`✅ job created: ${job.id}`);
}
await sb
  .from("job_candidates")
  .upsert({ job_id: job.id, profile_id: profileId }, { onConflict: "job_id,profile_id" });
console.log("   candidate curated onto the job");

// 4. Clean favorites so the spec starts from a known state -------------------
await sb.from("portal_favorites").delete().eq("client_id", client.id);

fs.mkdirSync("e2e/.auth", { recursive: true });
fs.writeFileSync(
  "e2e/.auth/portal-qa.json",
  JSON.stringify(
    {
      username: CLIENT_USERNAME,
      password: CLIENT_PASSWORD,
      company: CLIENT_COMPANY,
      candidateName: CANDIDATE_NAME,
      jobTitle: JOB_TITLE,
      jobId: job.id,
      clientId: client.id,
      profileId,
    },
    null,
    2
  )
);
console.log("\n🎉 portal QA fixture ready → e2e/.auth/portal-qa.json");
