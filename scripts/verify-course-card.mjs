// Admin member profile: the active-course card renders apart and loud.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SUB_TEST_ID = "3a9beb05-7dd2-415d-8b0d-ebe606df2ee6"; // active: אוטומציה עסקית since 21.08
const SHOTS = process.env.SHOTS_DIR || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin.qa@opencode.test");
await page.fill('input[name="password"]', requireEnv("QA_ADMIN_PASSWORD"));
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
await page.goto(`${BASE}/admin/members/${SUB_TEST_ID}`);
await page.waitForLoadState("networkidle");

const header = await page.locator('text="הקורסים שלה"').first().isVisible().catch(() => false);
const activeBadge = await page.locator('text="הקורס הפעיל שלה"').first().isVisible().catch(() => false);
const title = await page.locator('text="אוטומציה עסקית"').first().isVisible().catch(() => false);
const swap = await page.locator("text=זכאות החלפה").first().isVisible().catch(() => false);
console.log(header ? "✅ 'הקורסים שלה' card" : "❌ card missing");
console.log(activeBadge ? "✅ active-course badge" : "❌ active badge missing");
console.log(title ? "✅ course title shown" : "❌ title missing");
console.log(swap ? "✅ swap-eligibility date shown" : "❌ swap date missing");

const card = page.locator('text="הקורסים שלה"').first();
await card.scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: `${SHOTS}/course-card-admin.png` });
await browser.close();
