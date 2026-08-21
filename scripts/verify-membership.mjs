// Real-browser verification of the membership-model build on deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();

const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const FIXTURE_PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const ADMIN_PASS = requireEnv("QA_ADMIN_PASSWORD");
const results = [];
const ok = (name, pass, extra = "") => results.push(`${pass ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}

// ── A. the mentor applicant BEFORE approval: /join shows the pending message
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "mentor.test@opencode.test", FIXTURE_PASS);
  await page.goto(`${BASE}/join`);
  await page.waitForLoadState("networkidle");
  ok("mentor-pending message shown", (await page.locator("text=הבקשה שלך להצטרף כמנטורית").count()) > 0);
  ok("pending mentions approval email", (await page.locator("text=מייל").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-1-mentor-pending.png` });
  await page.close();
}

// ── B. the paying member: subscription card, cancel → banner → resume, course swap dates
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "sub.test@opencode.test", FIXTURE_PASS);

  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  ok("subscription card shown", (await page.locator("text=המנוי שלי").count()) > 0);
  ok("renewal date shown", (await page.locator("text=מתחדש אוטומטית ב-").count()) > 0);
  await page.locator('button:has-text("ביטול חידוש המנוי")').click();
  await page.waitForSelector("text=רגע לפני שנפרדות");
  ok("cancel warning lists losses", (await page.locator("text=ספריית הקורסים").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-2-cancel-warning.png` });
  await page.locator('button:has-text("כן, לבטל את החידוש")').click();
  await page.waitForSelector("text=ביטלת את חידוש המנוי", { timeout: 20000 });
  ok("canceled state shown", true);

  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  ok("app-wide cancel banner", (await page.locator("text=ביטלת את חידוש המנוי — הוא פעיל עד").count()) > 0
    || (await page.locator("text=ביטלת את החידוש").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-3-cancel-banner.png` });

  await page.goto(`${BASE}/profile`);
  await page.locator('button:has-text("התחרטתי")').click();
  await page.waitForSelector("text=מתחדש אוטומטית ב-", { timeout: 20000 });
  ok("resume restores renewal", true);

  // course library: take a course, then the dates must print everywhere
  await page.goto(`${BASE}/courses`);
  await page.waitForLoadState("networkidle");
  const startBtn = page.locator('button:has-text("התחילי קורס")').first();
  if (await startBtn.count()) {
    await startBtn.click();
    await page.waitForSelector("text=הקורס הפעיל שלך", { timeout: 25000 });
  }
  ok("active hero shows swap date", (await page.locator("text=זכאות החלפת קורס:").count()) > 0);
  ok("locked cards show swap date", (await page.locator("text=זכאות החלפת קורס").count()) > 1);
  await page.screenshot({ path: `${SHOTS}/mm-4-course-dates.png`, fullPage: true });
  await page.close();
}

// ── C. admin: approval queue → approve → score line; junior search panel
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "admin.qa@opencode.test", ADMIN_PASS);
  await page.goto(`${BASE}/admin/mentors`);
  await page.waitForLoadState("networkidle");
  ok("approval queue shows applicant", (await page.locator("text=בקשות הצטרפות כמנטורית").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-5-approval-queue.png` });
  await page.locator('button:has-text("אישור 👑")').first().click();
  await page.waitForTimeout(4000);
  await page.goto(`${BASE}/admin/mentors`);
  await page.waitForLoadState("networkidle");
  ok("applicant approved (queue gone)", (await page.locator("text=בקשות הצטרפות כמנטורית").count()) === 0);
  ok("score breakdown line shown", (await page.locator("text=תשובות בפורום").count()) > 0);

  await page.goto(`${BASE}/admin/mentor-requests?jyears=0&jq=`);
  await page.waitForLoadState("networkidle");
  ok("junior search panel renders", (await page.locator("text=חיפוש בין הג׳וניוריות").count()) > 0
    || (await page.locator("text=חיפוש בין הג").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-6-junior-search.png` });
  await page.close();
}

// ── D. the mentor AFTER approval: hidden tabs, guards, public spotlight
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "mentor.test@opencode.test", FIXTURE_PASS);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  const jobsLink = await page.locator('aside a[href="/jobs"], nav a[href="/jobs"]').count();
  const coursesLink = await page.locator('aside a[href="/courses"], nav a[href="/courses"]').count();
  ok("sidebar hides jobs for mentor", jobsLink === 0);
  ok("sidebar hides courses for mentor", coursesLink === 0);
  await page.screenshot({ path: `${SHOTS}/mm-7-mentor-sidebar.png` });

  await page.goto(`${BASE}/jobs`);
  ok("jobs page shows mentor note", (await page.locator("text=לוח המשרות מיועד לחברות").count()) > 0);
  await page.goto(`${BASE}/courses`);
  ok("courses page shows mentor note", (await page.locator("text=ספריית הקורסים מיועדת לחברות").count()) > 0);
  await page.close();
}

// ── E. everyone sees who the mentors are: directory + public spotlight
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "sub.test@opencode.test", FIXTURE_PASS);
  await page.goto(`${BASE}/members?q=מנטורית בדיקה`);
  await page.waitForLoadState("networkidle");
  ok("directory shows mentor badge", (await page.locator("text=👑 מנטורית").count()) > 0);
  await page.locator('a:has-text("מנטורית בדיקה")').first().click();
  await page.waitForSelector("text=קצת על המנטורית", { timeout: 20000 });
  ok("public spotlight card", true);
  ok("workplace exposed", (await page.locator("text=חברת הייטק לדוגמה").count()) > 0);
  ok("years exposed", (await page.locator("text=7 שנות ניסיון").count()) > 0);
  ok("contribution exposed", (await page.locator("text=מענה לשאלות מקצועיות").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-8-mentor-spotlight.png` });
  await page.close();
}

// ── F. portal: mentors hidden by default, revealed by the explicit toggle
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/portal/login`);
  await page.fill('input[name="username"]', "e2e-qa-client");
  await page.fill('input[name="password"]', "qa-e2e-portal-2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 });
  await page.goto(`${BASE}/portal`);
  await page.waitForLoadState("networkidle");
  ok("portal default hides mentor", (await page.locator("text=מנטורית בדיקה").count()) === 0);
  ok("toggle link present", (await page.locator("text=הצגת גם מנטוריות").count()) > 0);
  await page.goto(`${BASE}/portal?mentors=1`);
  await page.waitForLoadState("networkidle");
  ok("toggled: mentor appears with badge", (await page.locator("text=מנטורית בדיקה").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/mm-9-portal-mentors.png` });
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
