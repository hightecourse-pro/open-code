// Browser verification of the courses-screen rework on deployed staging.
// sub.test has an active course (אוטומציה עסקית) taken 21.8 — perfect fixture.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);

const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sub.test@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/courses`);
await page.waitForLoadState("networkidle");

ok("no החזרת קורס button", (await page.locator('button:has-text("החזרת קורס")').count()) === 0);
ok("catalogue folded behind a section", (await page.locator("text=כל הקורסים בספרייה").count()) > 0);
ok("fold subtitle carries the swap date", (await page.locator("text=הזכאות נפתחת ב-").count()) > 0);

// open the folded catalogue and inspect the cards
await page.locator("text=כל הקורסים בספרייה").click();
await page.waitForTimeout(400);
ok("cover shows course names (no lone letters)", (await page.locator("text=אוטומציה עסקית").count()) >= 2);
ok("active card marked הקורס שלך החודש", (await page.locator("text=הקורס שלך החודש").count()) === 1);
ok("active card has no start button", (await page.locator("text=את לומדת אותו עכשיו").count()) === 1);
ok("locked cards say נעול להחודש with date", (await page.locator("text=נעול להחודש").count()) > 0 && (await page.locator("text=זכאות החלפה מ-").count()) > 0);

const syllabusBtn = page.locator('button:has-text("מה לומדים בקורס?")').first();
ok("syllabus peek exists", (await page.locator('button:has-text("מה לומדים בקורס?")').count()) > 0);
if (await syllabusBtn.count()) {
  await syllabusBtn.click();
  await page.waitForTimeout(200);
}
ok("years wording (שנות הקורס)", (await page.locator("text=שנות הקורס").count()) > 0);
ok("no מחזורים wording", (await page.locator("text=מחזורים").count()) === 0);

await page.screenshot({ path: `${SHOTS}/courses-1-rework.png`, fullPage: true });
await browser.close();
console.log(results.join("\n"));
