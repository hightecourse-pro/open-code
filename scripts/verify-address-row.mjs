import { chromium } from "@playwright/test";
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin.qa@opencode.test");
await page.fill('input[name="password"]', "Nihul-Kehila-2026!vR7");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
await page.goto(`${BASE}/profile`);
await page.waitForLoadState("networkidle");
await page.locator('button:has-text("אני בתחילת הדרך")').click();
// Walk the wizard until the street field is on screen (never submitting).
for (let i = 0; i < 8; i++) {
  if (await page.locator("text=רחוב").first().isVisible().catch(() => false)) break;
  const next = page.locator('button:has-text("הבא")');
  if (!(await next.count())) break;
  await next.click();
  await page.waitForTimeout(400);
}
const street = page.locator('label:has-text("רחוב")').first();
const city = page.locator('label:has-text("עיר")').first();
const house = page.locator('label:has-text("מספר בית")').first();
const sb = await street.boundingBox();
const cb = await city.boundingBox();
const hb = await house.boundingBox();
console.log("city y:", cb?.y, "street y:", sb?.y, "house y:", hb?.y);
const sameRow = sb && cb && hb && Math.abs(sb.y - cb.y) < 8 && Math.abs(hb.y - cb.y) < 8;
console.log(sameRow ? "✅ city+street+house share one row" : "❌ not on one row");
await page.screenshot({ path: `${SHOTS}/sweep-8-address-row.png` });
await browser.close();
