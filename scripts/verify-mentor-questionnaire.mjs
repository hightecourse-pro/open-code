import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "checkout.probe@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
await page.goto(`${BASE}/forum`);
await page.waitForLoadState("networkidle");
console.log("onboarding gate:", (await page.locator("text=כמה פרטים ונצא לדרך").count()) > 0 ? "✅" : "❌");
console.log("no junior experience gate:", (await page.locator("text=אני בתחילת הדרך").count()) === 0 ? "✅ (mentor scope)" : "❌ junior gate shown");
// walk while filling nothing—the first step is names only for mentors
const next = page.locator('button:has-text("הבא")');
let mentorQ = false;
for (let i = 0; i < 8 && !mentorQ; i++) {
  mentorQ = (await page.locator("text=במה תרצי לתרום").count()) > 0 || (await page.locator("text=איפה את עובדת היום").count()) > 0;
  if (mentorQ) break;
  if (!(await next.count())) break;
  await next.click();
  await page.waitForTimeout(350);
}
console.log("mentor questions reachable:", mentorQ ? "✅" : "❌ (may be behind required fields)");
await page.screenshot({ path: `${SHOTS}/fix-1b-mentor-wizard.png`, fullPage: true });
await browser.close();
