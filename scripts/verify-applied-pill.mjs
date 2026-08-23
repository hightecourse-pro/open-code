// The applied job must be back on the board, with its status pill.
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
await page.goto(`${BASE}/jobs`);
await page.waitForLoadState("networkidle");

const appliedCard = page.locator('article:has-text("הוגשה ✓")');
const count = await appliedCard.count();
console.log("cards with applied pill:", count);
if (count > 0) {
  const txt = await appliedCard.first().innerText();
  console.log("card mentions status+date:", /הגשת — נעדכן/.test(txt) && /·/.test(txt) ? "✅" : "partial", "| has apply button:", /הגשת מועמדות/.test(txt) ? "❌ should not" : "✅ none");
  await appliedCard.first().screenshot({ path: `${SHOTS}/jobs-5-applied-pill.png` });
}
console.log(count > 0 ? "✅ applied job visible on the board with its status" : "❌ not found");
await browser.close();
