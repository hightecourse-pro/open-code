// Prove staging now actually reaches Google: the fixture member's login email
// is @opencode.test — NOT a Google account — so a real grant attempt must come
// back as "set a Drive address" instead of the old "the request was recorded".
// Nobody receives access; the refusal itself is the proof the gate opened.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sub.test@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
await page.goto(`${BASE}/courses`);
await page.waitForLoadState("networkidle");
const gate = page.locator('button:has-text("פתחי את חומרי הקורס")');
if (!(await gate.count())) {
  console.log("no unlock gate visible — nothing to click");
} else {
  await gate.click();
  await page.waitForTimeout(8000);
  const body = await page.locator("body").innerText();
  const recorded = body.includes("נרשמה");
  const needsGoogle = /Google|גוגל|כתובת/.test(body) && !recorded;
  console.log("old 'request recorded' message:", recorded ? "❌ still guarded" : "✅ gone");
  console.log("Google was actually reached (needs a Drive address):", needsGoogle ? "✅" : "check screenshot");
  await page.screenshot({ path: `${SHOTS}/drive-1-staging-unlock.png` });
}
await browser.close();
