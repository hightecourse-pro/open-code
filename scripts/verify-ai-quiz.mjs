// /ai-course end-to-end: both tracks get recommended right, an abandoned run
// shows as such, and the standalone Hightecourse admin (/ai-course/admin,
// same login as the community) tells the whole story. Creates its own
// throwaway admin + quiz rows on STAGING and removes every one of them.
// Run: node scripts/verify-ai-quiz.mjs   (SHOTS_DIR=… for the screenshots)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";

// Read the staging keys the way the repo keeps them (.env.local).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const QA = {
  advanced: "claude.qa.aiquiz.adv@opencode.test",
  foundations: "claude.qa.aiquiz.base@opencode.test",
  abandoned: "claude.qa.aiquiz.left@opencode.test",
  admin: "claude.qa.aiquiz.admin@opencode.test",
};
const ADMIN_PASSWORD = "Qa!" + Math.random().toString(36).slice(2, 12);

const ok = (cond, label) => console.log((cond ? "✅ " : "❌ ") + label);

async function runQuiz(page, { email, first, last, optionIndex, stopAfter = null }) {
  await page.goto(`${BASE}/ai-course`);
  await page.click("text=בואי נתחיל");
  await page.fill('input[autocomplete="given-name"]', first);
  await page.fill('input[autocomplete="family-name"]', last);
  await page.fill('input[autocomplete="email"]', email);
  await page.click('[data-testid="status-planning"]');
  await page.click("text=לשאלות");
  for (let i = 0; i < (stopAfter ?? 5); i++) {
    await page.waitForSelector(`text=שאלה ${i + 1} מתוך 5`);
    await page.click(`[data-testid="opt-${optionIndex}"]`);
    await page.waitForTimeout(350);
  }
  if (stopAfter != null) return; // walk away mid-form
  await page.waitForSelector("text=המסלול שמתאים לך", { timeout: 20000 });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 1100 } });

// Intro renders with the Hightecourse look.
await page.goto(`${BASE}/ai-course`);
await page.waitForSelector("text=איזה מסלול מתאים לך?");
await page.screenshot({ path: `${SHOTS}/aiquiz-1-intro.png` });

// Pass 1: confident answers all the way -> the very-advanced track.
await runQuiz(page, { email: QA.advanced, first: "קיו-איי", last: "מתקדמת", optionIndex: 0 });
const advBadge = await page.locator("text=מתקדם מאוד").first().isVisible().catch(() => false);
ok(advBadge, "confident answers -> 'מתקדם מאוד'");
await page.screenshot({ path: `${SHOTS}/aiquiz-2-result-advanced.png` });
await page.click("text=כן, שבצו אותי");
await page.waitForSelector("text=קיבלנו. שומרות לך מקום");
await page.screenshot({ path: `${SHOTS}/aiquiz-3-done.png` });

// Pass 2: beginner answers -> the foundations track, then "עוד מתלבטת".
await runQuiz(page, { email: QA.foundations, first: "קיו-איי", last: "מתחילה", optionIndex: 2 });
const baseBadge = await page.locator("text=מהבסיס — כולל תרגול").first().isVisible().catch(() => false);
ok(baseBadge, "beginner answers -> 'מהבסיס — כולל תרגול'");
await page.screenshot({ path: `${SHOTS}/aiquiz-2b-result-foundations.png` });
await page.click("text=עוד מתלבטת");

// Pass 3: walks away after two questions - the admin should see that.
await runQuiz(page, { email: QA.abandoned, first: "קיו-איי", last: "נוטשת", optionIndex: 1, stopAfter: 2 });

// The reported bug (the owner, 20/10: "אחרי השאלה השניה הוא קופץ לי להתחלה"):
// a mid-quiz reload must land her back on the same question, not the intro.
await page.reload({ waitUntil: "networkidle" });
const resumed = await page
  .waitForSelector("text=שאלה 3 מתוך 5", { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
ok(resumed, "reload mid-quiz resumes at question 3 (not the intro)");
await page.screenshot({ path: `${SHOTS}/aiquiz-3b-resume.png` });

// DB truth behind the three runs.
const { data: rows } = await admin
  .from("ai_course_quiz_submissions")
  .select("email, recommendation, wants_placement, completed_at, questions_done")
  .in("email", [QA.advanced, QA.foundations, QA.abandoned]);
const by = Object.fromEntries((rows ?? []).map((r) => [r.email, r]));
ok(by[QA.advanced]?.recommendation === "advanced" && by[QA.advanced]?.wants_placement === true, "DB: advanced + placement=yes");
ok(by[QA.foundations]?.recommendation === "foundations" && by[QA.foundations]?.wants_placement === false, "DB: foundations + placement=hesitant");
ok(!by[QA.abandoned]?.completed_at && by[QA.abandoned]?.questions_done === 2, "DB: abandoned after 2/5");

// Throwaway admin signs into the STANDALONE Hightecourse admin with the same
// kind of credentials the owner uses, straight on /ai-course/admin.
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email: QA.admin,
  password: ADMIN_PASSWORD,
  email_confirm: true,
});
if (cErr) console.log("❌ temp admin create:", cErr.message);
await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA אדמינית", role: "admin", status: "active" });

await page.goto(`${BASE}/ai-course/admin`);
await page.waitForSelector("text=כניסת מנהלת");
await page.screenshot({ path: `${SHOTS}/aiquiz-4-admin-login.png` });
await page.fill('input[name="email"]', QA.admin);
await page.fill('input[name="password"]', ADMIN_PASSWORD);
await page.click("text=כניסה");
await page.waitForSelector("text=שאלון בחירת המסלול", { timeout: 20000 });
await page.setViewportSize({ width: 1360, height: 950 });
const sawAbandon = await page.locator("text=נעצרה אחרי 2/5 שאלות").first().isVisible().catch(() => false);
const sawAdv = await page.locator("text=מתקדם מאוד").first().isVisible().catch(() => false);
const sawBase = await page.locator("text=מהבסיס + תרגול").first().isVisible().catch(() => false);
ok(sawAbandon, "admin: abandonment visible");
ok(sawAdv && sawBase, "admin: both recommendations visible");
await page.screenshot({ path: `${SHOTS}/aiquiz-5-admin.png`, fullPage: true });

// Leave staging exactly as we found it.
await admin.from("ai_course_quiz_submissions").delete().in("email", Object.values(QA));
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);
console.log("🧹 cleaned: quiz rows + temp admin");

await browser.close();
