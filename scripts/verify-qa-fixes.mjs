// Browser verification of the QA-round fixes on deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);

const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}

// ── mentor track actually switches now (the trigger bug) ─────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // checkout.probe is a pending paid-track junior — perfect applicant.
  await login(page, "checkout.probe@opencode.test", PASS);
  await page.goto(`${BASE}/join`);
  await page.waitForLoadState("networkidle");
  await page.locator('button:has-text("הגשת בקשה למנטורית בקהילה")').click();
  // The server action redirects to /forum, where the gate reopens as the
  // mentor questionnaire — wait for the actual navigation, not load state.
  await page.waitForURL((u) => u.pathname.startsWith("/forum"), { timeout: 25000 });
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=הפרופיל שלך", { timeout: 15000 }).catch(() => {});
  // She should now face the MENTOR questionnaire — its questions, not the junior's.
  const mentorQ = (await page.locator("text=במה תרצי לתרום").count()) > 0 ||
    (await page.locator("text=איפה את עובדת היום").count()) > 0;
  // walk a step or two to find them (shared step first)
  let found = mentorQ;
  for (let i = 0; i < 6 && !found; i++) {
    const next = page.locator('button:has-text("הבא")');
    if (!(await next.count())) break;
    await next.click().catch(() => {});
    await page.waitForTimeout(300);
    found = (await page.locator("text=במה תרצי לתרום").count()) > 0 ||
      (await page.locator("text=איפה את עובדת היום").count()) > 0;
  }
  ok("mentor apply opens the MENTOR questionnaire", found);
  // no junior-only questions in this flow
  ok("junior street question absent", (await page.locator('label:has-text("רחוב")').count()) === 0);
  await page.screenshot({ path: `${SHOTS}/fix-1-mentor-questionnaire.png` });
  await page.close();
}

// ── raw-HTML detection: a mid-string tag renders as formatting ───────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page, "sub.test@opencode.test", PASS);
  await page.goto(`${BASE}/chat`);
  await page.waitForLoadState("networkidle");
  const thread = page.locator('a[href*="/chat?c="]').first();
  if (await thread.count()) {
    await thread.click();
    await page.waitForLoadState("networkidle");
    // type text then bold a word: produces a body starting with a text node
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await editor.type("בדיקת תגית ");
    await editor.press("Control+b");
    await editor.type("מודגש");
    await editor.press("Enter");
    await page.waitForTimeout(2500);
    const raw = await page.locator('text=<b>').count();
    ok("no literal <b> in the sent bubble", raw === 0);
    ok("bold rendered as bold", (await page.locator("article b, div b").filter({ hasText: "מודגש" }).count()) > 0);
    await page.screenshot({ path: `${SHOTS}/fix-2-html-body.png` });
  } else {
    ok("no thread available for html check", false);
  }

  // emoji palette exists in the composer
  ok("emoji button in editor", (await page.locator('button[aria-label="אימוג\'י"]').count()) > 0);

  // focus stays in the box after sending (activeElement is the editor)
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true");
  ok("composer keeps focus after send", focused);
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
