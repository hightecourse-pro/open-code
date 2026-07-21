// Removes the artifacts the e2e suites create, so test runs never pollute what
// real members see. Safe to run any time; deletes ONLY clearly-marked E2E data:
//   * forum posts by the test admin whose body starts with "בדיקת E2E"
//   * jobs created by the admin-flow spec (company "E2E TestCo")
//   * courses titled "קורס E2E …"
// The portal QA fixture (client/candidate/job) is managed separately by
// scripts/seed-portal-qa.mjs --cleanup.
//   node --env-file=.env.local scripts/cleanup-e2e-data.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- forum posts from the e2e user-flow spec ---------------------------------
const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
const adminId = users?.users?.find((u) => u.email === "admin@opencode.test")?.id;
if (adminId) {
  const { data: posts } = await sb
    .from("posts")
    .select("id")
    .eq("author_id", adminId)
    .like("body", "בדיקת E2E%");
  const ids = (posts ?? []).map((p) => p.id);
  if (ids.length) {
    await sb.from("reactions").delete().in("post_id", ids);
    await sb.from("comments").delete().in("post_id", ids);
    await sb.from("posts").delete().in("id", ids);
  }
  console.log(`posts: removed ${ids.length}`);
} else {
  console.log("posts: test admin not found, skipped");
}

// --- jobs from the admin-flow spec ------------------------------------------
const { data: jobs } = await sb.from("jobs").select("id").eq("company", "E2E TestCo");
const jobIds = (jobs ?? []).map((j) => j.id);
if (jobIds.length) {
  await sb.from("job_candidates").delete().in("job_id", jobIds);
  await sb.from("applications").delete().in("job_id", jobIds);
  await sb.from("jobs").delete().in("id", jobIds);
}
console.log(`jobs (E2E TestCo): removed ${jobIds.length}`);

// --- courses from the admin-flow spec ---------------------------------------
const { data: courses } = await sb.from("courses").select("id").like("title", "קורס E2E%");
const courseIds = (courses ?? []).map((c) => c.id);
if (courseIds.length) {
  // Drive links hang off courses; clear them first in case the FK isn't cascading.
  await sb.from("drive_links").delete().in("course_id", courseIds).then(() => {}, () => {});
  await sb.from("courses").delete().in("id", courseIds);
}
console.log(`courses (קורס E2E): removed ${courseIds.length}`);

console.log("🧹 e2e artifacts cleaned");
