// Current board contract (tester round 2026-08-26): a job she applied to
// LEAVES the board and lives in "ההגשות שלי" with its status pill. (This
// script used to assert the opposite — the 2026-08-25 behavior.)
// Run AFTER verify-jobs-redesign, which creates the application.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sub.test@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

// Her applications live in the mine view, each with a status pill.
await page.goto(`${BASE}/jobs?view=mine`);
await page.waitForLoadState("networkidle");
const mineText = (await page.textContent("body")) ?? "";
const appliedTitles = ["Junior Frontend Developer"].filter((t) => mineText.includes(t));
if (!appliedTitles.length) {
  console.log("❌ no applications in ההגשות שלי — run verify-jobs-redesign first (it applies)");
  await browser.close();
  process.exit(1);
}
const hasPill = /הוגשה לקוד פתוח|בבדיקה אצלנו|התקבלת|לא התקדם/.test(mineText);
console.log(hasPill ? "✅ mine view shows the application with a status pill" : "❌ status pill missing in mine view");
await page.screenshot({ path: `${SHOTS}/jobs-5-applied-pill.png`, fullPage: true });

// And the same job is OFF the board — it would be duplication.
await page.goto(`${BASE}/jobs`);
await page.waitForLoadState("networkidle");
const boardTitles = await page.locator("article .font-display").allTextContents();
// Staging holds a TWIN job with the same title — count, don't text-match:
// after applying, at most one JFD card (the twin) may remain.
const jfd = boardTitles.filter((t) => t.includes("Junior Frontend Developer")).length;
console.log(jfd <= 1 ? `✅ applied job left the board (${jfd} twin card remains)` : "❌ applied job still on the board");
const dup = jfd > 1;
await browser.close();
process.exit(hasPill && !dup ? 0 : 1);
