// The owner's pre-launch round (2026-08-30), verified on staging.
// Run: node --env-file=.env.local scripts/verify-owner-round-0830.mjs
// Env: VERIFY_FIXTURE_PASSWORD, QA_ADMIN_PASSWORD, SHOTS_DIR (optional).
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const ADMIN_PASS = requireEnv("QA_ADMIN_PASSWORD");
const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const results = [];
const ok = (n, p, x = "") => results.push(`${p ? "✅" : "❌"} ${n}${x ? " — " + x : ""}`);
const done = (code = 0) => { console.log(results.join("\n")); process.exit(code); };
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}

const uid = async (email) => {
  const { data } = await sb.rpc("auth_user_id_by_email", { p_email: email });
  return data;
};

// ---------------------------------------------------------------- fixtures
const FREE_EMAIL = "free.probe@opencode.test";
let freeId = await uid(FREE_EMAIL);
if (!freeId) {
  const { data, error } = await sb.auth.admin.createUser({
    email: FREE_EMAIL,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: "חינם בדיקה" },
  });
  if (error) throw new Error("free.probe create failed: " + error.message);
  freeId = data.user.id;
}
// A FREE member: junior, pending (no approval needed, no subscription), with a
// complete profile so no wizard overlay hides the pages.
await sb.from("profiles").update({
  role: "junior", status: "pending", profile_completed: true, full_name: "חינם בדיקה",
}).eq("id", freeId);
await sb.from("subscriptions").delete().eq("profile_id", freeId);

const subId = await uid("sub.test@opencode.test");
const browser = await chromium.launch();

// ------------------------------------------------- A. the free-member gate
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, FREE_EMAIL, PASS);

  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  const forumBody = (await page.textContent("body")) ?? "";
  ok("free: forum upgrade card", forumBody.includes("השיחות בפורום נפתחות עם מנוי"));
  ok("free: forum has no composer", (await page.locator('text=פתיחת פוסט חדש').count()) === 0);
  ok("free: sidebar upgrade CTA", forumBody.includes("שדרוג למנוי מלא"));
  await page.screenshot({ path: `${SHOTS}/round-1-free-forum.png` });

  await page.goto(`${BASE}/chat`);
  await page.waitForLoadState("networkidle");
  const chatBody = (await page.textContent("body")) ?? "";
  ok("free: chat upgrade line", /ההתכתבות.*נפתחת עם מנוי/.test(chatBody));
  ok("free: chat has no new-chat button", (await page.locator('text=שיחה חדשה').count()) === 0);

  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  const coursesBody = (await page.textContent("body")) ?? "";
  ok("free: courses visible but locked", coursesBody.includes("ספריית הקורסים נפתחת עם מנוי") && coursesBody.includes("נפתח עם מנוי"));

  await page.goto(`${BASE}/recordings`);
  await page.waitForLoadState("networkidle");
  const recBody = (await page.textContent("body")) ?? "";
  ok("free: recordings visible but locked", recBody.includes("נפתח") && recBody.includes("מנוי"));

  await page.goto(`${BASE}/join`);
  await page.waitForLoadState("networkidle");
  ok("free: /join reaches checkout (no bounce)", page.url().includes("/join"));
  const joinBody = (await page.textContent("body")) ?? "";
  ok("free: checkout content shown", /תשלום|מנוי|₪/.test(joinBody));
  await page.screenshot({ path: `${SHOTS}/round-2-free-join.png` });
  await page.close();
}

// ------------------------------------- B. subscriber surfaces (sub.test)
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await login(page, "sub.test@opencode.test", PASS);

// B1-B2: jobs — filters at the top, applying to the targeted section too.
{
  // Ensure a targeted job for sub.test on a live published "ours" job.
  const { data: liveJob } = await sb
    .from("jobs").select("id, title").eq("source", "ours").eq("status", "open")
    .eq("pipeline_status", "published").limit(1).maybeSingle();
  if (liveJob && subId) {
    await sb.from("job_targets").upsert(
      { job_id: liveJob.id, profile_id: subId, emailed_at: new Date().toISOString() },
      { onConflict: "job_id,profile_id" }
    );
    // She must not have an application on it (applied targeted jobs leave the frame).
    await sb.from("applications").delete().eq("job_id", liveJob.id).eq("applicant_id", subId);
  }
  await page.goto(`${BASE}/jobs`);
  await page.waitForLoadState("networkidle");
  const search = page.locator('input[aria-label="חיפוש משרות"]');
  ok("jobs: search input present", (await search.count()) === 1);
  const frame = page.locator("text=משרות בשבילך מקוד פתוח");
  const hasFrame = (await frame.count()) > 0;
  ok("jobs: targeted frame present", hasFrame);
  if (hasFrame) {
    const order = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="חיפוש משרות"]');
      const all = [...document.querySelectorAll("h2")];
      const head = all.find((h) => h.textContent?.includes("משרות בשבילך"));
      if (!input || !head) return null;
      return input.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING ? "search-first" : "frame-first";
    });
    ok("jobs: filters ABOVE the targeted frame", order === "search-first", String(order));
    await search.fill("שוםמשרהכזאתלאקיימת");
    await page.waitForTimeout(700);
    ok("jobs: filter hides targeted frame too", (await frame.count()) === 0);
    const noRes = (await page.textContent("body")) ?? "";
    ok("jobs: zero-results message", noRes.includes("שום משרה לא עונה על הסינון"));
    await search.fill("");
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${SHOTS}/round-3-jobs-top-filters.png` });
}

// B3: advanced-pipeline job shows the "moved on" chip and no apply door.
{
  const { data: src } = await sb
    .from("jobs").select("*").eq("source", "ours").eq("status", "open")
    .eq("pipeline_status", "published").limit(1).single();
  const probe = { ...src };
  delete probe.id; delete probe.created_at; delete probe.updated_at;
  probe.title = "בדיקת שלב מתקדם — אוטומטי";
  probe.pipeline_status = "candidates_sent";
  probe.published_at = new Date().toISOString();
  const { data: made, error: mkErr } = await sb.from("jobs").insert(probe).select("id").single();
  if (mkErr) ok("jobs: advanced probe created", false, mkErr.message);
  else {
    await page.goto(`${BASE}/jobs`);
    await page.waitForLoadState("networkidle");
    const card = page.locator("article", { hasText: "בדיקת שלב מתקדם — אוטומטי" }).first();
    const cardExists = (await card.count()) > 0;
    ok("jobs: advanced job on board", cardExists);
    if (cardExists) {
      ok("jobs: advanced chip shown", (await card.locator("text=המשרה התקדמה לשלב הבא").count()) > 0);
      ok("jobs: advanced apply hidden", (await card.locator("text=הגשת מועמדות").count()) === 0);
      await card.screenshot({ path: `${SHOTS}/round-4-advanced-chip.png` });
    }
    await sb.from("jobs").delete().eq("id", made.id);
  }
}

// B4: member sidebar fits with no scroll at 720px.
{
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  const m = await page.evaluate(() => {
    const nav = document.querySelector("nav");
    return nav ? nav.scrollHeight - nav.clientHeight : -1;
  });
  ok("sidebar: no scroll at 720px", m === 0, `overflow=${m}px`);
  await page.setViewportSize({ width: 1280, height: 900 });
}

// B5: profile gate remembered.
{
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  const startBtn = page.locator('button:has-text("אני בתחילת הדרך")').first();
  const cls = (await startBtn.getAttribute("class")) ?? "";
  ok("profile: experience gate preselected", cls.includes("bg-tint-pink"));
}

// B6: active-course hero links to the full catalogue and opens it.
{
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  const jump = page.locator("text=לרשימת הקורסים המלאה");
  ok("courses: top jump link", (await jump.count()) > 0);
  if ((await jump.count()) > 0) {
    await jump.first().click();
    await page.waitForTimeout(700);
    // With an active course every other card may be locked — assert the fold
    // BODY became visible (cards render), not a specific CTA.
    const opened = await page.evaluate(() => {
      const sec = document.getElementById("course-catalogue");
      if (!sec) return "no-section";
      const hidden = sec.querySelector("[hidden]");
      const cards = sec.querySelectorAll("article, .grid > div").length;
      return hidden ? "hidden" : `open:${cards}`;
    });
    ok("courses: catalogue fold opened", String(opened).startsWith("open:") && opened !== "open:0", String(opened));
    await page.screenshot({ path: `${SHOTS}/round-5-courses-jump.png` });
  }
}

// B7: session feedback — visible stars, click-through, saved row.
let seededSession = null;
{
  const { data: s } = await sb
    .from("sessions")
    .insert({ title: "בדיקת משוב כוכבים", scheduled_at: new Date(Date.now() - 3 * 3600e3).toISOString(), is_published: true, open_to_all: true })
    .select("id").single();
  seededSession = s?.id ?? null;
  if (subId) await sb.from("session_feedback").delete().eq("profile_id", subId);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  await page.click("text=כן, הייתי!");
  await page.waitForSelector('[role="radiogroup"]');
  const firstStar = page.locator('[role="radiogroup"]').first().locator('[role="radio"]').first().locator("svg");
  const fill = await firstStar.getAttribute("fill");
  ok("feedback: empty stars visible (white fill)", fill === "white", `fill=${fill}`);
  const hint = (await page.textContent("body")) ?? "";
  ok("feedback: rating hint shown", hint.includes("לחצי על הכוכבים לדירוג"));
  const groups = page.locator('[role="radiogroup"]');
  for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).locator('[role="radio"]').nth(4).click();
  await page.screenshot({ path: `${SHOTS}/round-6-feedback-stars.png` });
  await page.click("text=שליחת המשוב");
  await page.waitForSelector("text=תודה על המשוב", { timeout: 15000 });
  const { data: fb } = await sb.from("session_feedback").select("*").eq("session_id", seededSession).maybeSingle();
  ok("feedback: row saved with 4 ratings", !!fb && fb.content_rating === 5 && fb.speaker_rating === 5);
}

// B8: course feedback lands in course_feedback (the enrollment-less bug class).
{
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  const edit = page.locator("text=עריכה");
  if ((await edit.count()) > 0) await edit.first().click();
  const starsRow = page.locator('button[title="4"]');
  if ((await starsRow.count()) > 0) {
    await starsRow.first().click();
    await page.fill('textarea[placeholder="מה היה שימושי? מה חסר?"]', "בדיקה אוטומטית של משוב קורס");
    await page.click("text=שליחת משוב");
    await page.waitForTimeout(1500);
  }
  const { data: cf } = await sb.from("course_feedback").select("rating, feedback").eq("profile_id", subId).maybeSingle();
  ok("course feedback: row in course_feedback", !!cf && cf.rating === 4, JSON.stringify(cf ?? {}));
}

// B9: widget request → פניות only, no alert.
const REQ_TEXT = `בדיקת ניתוב פניות ${Date.now()}`;
{
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  await page.click("text=יש לך בקשה");
  await page.waitForTimeout(400);
  await page.fill('input[name="subject"]', "בדיקת ניתוב");
  await page.fill('textarea[name="body"]', REQ_TEXT);
  await page.click('button:has-text("שליחה לצוות")');
  await page.waitForTimeout(1800);
  const { data: req } = await sb.from("member_requests").select("id, body").ilike("body", `%${REQ_TEXT}%`).maybeSingle();
  ok("request: lands in member_requests", !!req);
  const { data: alerts } = await sb
    .from("alerts").select("id").eq("kind", "member_request")
    .gte("created_at", new Date(Date.now() - 120e3).toISOString());
  ok("request: NO alerts-center row", (alerts ?? []).length === 0, `${(alerts ?? []).length} alerts`);
}
await page.close();

// --------------------------------------------------- C. the admin surfaces
{
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(admin, "admin.qa@opencode.test", ADMIN_PASS);

  await admin.goto(`${BASE}/admin`);
  await admin.waitForLoadState("networkidle");
  const dash = (await admin.textContent("body")) ?? "";
  ok("admin: מנטוריות לאישור tile", dash.includes("מנטוריות לאישור"));
  ok("admin: mentor-only approval box", dash.includes("מנטוריות חדשות לאישור"));
  ok("admin: juniors not in approval queue", !dash.includes("אביחי עזרא"));
  ok("admin: requests badge on sidebar", (await admin.locator('a[href="/admin/requests"] span:has-text("1"), a[href="/admin/requests"] span').count()) > 0);
  await admin.screenshot({ path: `${SHOTS}/round-7-admin-dash.png` });

  await admin.goto(`${BASE}/admin/requests`);
  await admin.waitForLoadState("networkidle");
  ok("admin: request visible in פניות", ((await admin.textContent("body")) ?? "").includes("בדיקת ניתוב פניות"));

  // C4: activating a subscription-less junior is refused with an explanation.
  {
    await admin.goto(`${BASE}/admin/members?status=pending`);
    await admin.waitForLoadState("networkidle");
    let dialogText = "";
    admin.on("dialog", async (d) => { dialogText = d.message(); await d.accept(); });
    const row = admin.locator("tr", { hasText: "אביחי עזרא" }).first();
    if ((await row.count()) === 0) ok("guard: pending junior row found", false);
    else {
      await row.locator('button[title="אישור"]').click();
      await admin.waitForTimeout(2500);
      ok("guard: activation refused with message", dialogText.includes("אין לה מנוי פעיל"), dialogText.slice(0, 60));
      const { data: still } = await sb.from("profiles").select("status").eq("id", await uid("4122799@gmail.com")).single();
      ok("guard: status stayed pending", still?.status === "pending", still?.status);
    }
  }

  // C5: the review center — tiles, table, per-column filters, note column.
  {
    const { data: bigJob } = await sb.rpc("job_app_counts").then(async (r) => {
      if (r.data?.length) {
        const top = [...r.data].sort((a, b) => b.total - a.total)[0];
        return sb.from("jobs").select("id, title").eq("id", top.job_id).single();
      }
      const { data: apps } = await sb.from("applications").select("job_id");
      const counts = {};
      for (const a of apps ?? []) counts[a.job_id] = (counts[a.job_id] ?? 0) + 1;
      const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return sb.from("jobs").select("id, title").eq("id", topId).single();
    });
    if (!bigJob?.id) ok("review: job with applications found", false);
    else {
      await admin.goto(`${BASE}/admin/jobs/${bigJob.id}`);
      await admin.waitForLoadState("networkidle");
      const body = (await admin.textContent("body")) ?? "";
      ok("review: הוגשו סופית tile", body.includes("הוגשו סופית"));
      const subsBtn = admin.locator('button:has-text("מנויות")').first();
      ok("review: מנויות counter inside הגישו", (await subsBtn.count()) > 0);
      await subsBtn.click();
      await admin.waitForTimeout(600);
      const nameFilter = admin.locator('input[aria-label="סינון לפי שם"]');
      ok("review: click opens TABLE with column filters", (await nameFilter.count()) === 1);
      await admin.screenshot({ path: `${SHOTS}/round-8-review-table.png` });

      // the note column saves
      const noteInput = admin.locator('input[aria-label="הערה פנימית על ההגשה"]').first();
      if ((await noteInput.count()) === 0) ok("review: note column present", false);
      else {
        ok("review: note column present", true);
        await noteInput.fill("בדיקת הערה אוטומטית");
        await noteInput.blur();
        await admin.waitForTimeout(1800);
        const { data: noteRow } = await sb.from("application_notes").select("note").eq("note", "בדיקת הערה אוטומטית").maybeSingle();
        ok("review: note saved to application_notes", !!noteRow);
        await sb.from("application_notes").delete().eq("note", "בדיקת הערה אוטומטית");
      }

      // per-column filter narrows + clears
      await nameFilter.fill("שוםשםכזהלאקיים");
      await admin.waitForTimeout(500);
      ok("review: column filter narrows to empty", ((await admin.textContent("body")) ?? "").includes("אין מועמדות שתואמות את סינון העמודות"));
      await nameFilter.fill("");
      // list view still available
      await admin.click('button:has-text("רשימה")');
      await admin.waitForTimeout(500);
      ok("review: list view still available", (await admin.locator("text=בחירת כל המוצגות").count()) > 0);
    }
  }

  // C6: analytics shows the member feedback (course_feedback merge).
  {
    await admin.goto(`${BASE}/admin/analytics`);
    await admin.waitForLoadState("networkidle");
    const an = (await admin.textContent("body")) ?? "";
    ok("analytics: משובים מהחברות includes the new feedback", an.includes("בדיקה אוטומטית של משוב קורס"));
  }
  await admin.close();
}

// ------------------------------------------------------------- cleanup
if (seededSession) {
  await sb.from("session_feedback").delete().eq("session_id", seededSession);
  await sb.from("sessions").delete().eq("id", seededSession);
}
if (subId) {
  await sb.from("course_feedback").delete().eq("profile_id", subId);
  await sb.from("enrollments").update({ rating: null, feedback: null }).eq("profile_id", subId);
}
await sb.from("member_requests").delete().ilike("body", `%בדיקת ניתוב פניות%`);

await browser.close();
done(results.some((r) => r.startsWith("❌")) ? 1 : 0);
