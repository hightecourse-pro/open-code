// Verify the first-entry flow changes on deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

// checkout.probe: pending junior with profile_completed=true — flip to
// incomplete via the profile page? Simpler: verify the gate card on /profile
// wizard is NOT shown (edit mode), and on the /join page the benefits list is.
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "checkout.probe@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/join`);
await page.waitForLoadState("networkidle");
ok("benefits list on join", (await page.locator("text=מה מקבלים במנוי?").count()) === 1);
ok("benefits: hightecourse library", (await page.locator("text=ספריית הקורסים של הייטקורס").count()) === 1);
ok("benefits: hackathons", (await page.locator("text=השתתפות בהאקתונים").count()) === 1);
await page.screenshot({ path: `${SHOTS}/flow-1-join-benefits.png` });

// the mentor card on the ONBOARDING gate (simulate: set profile_completed=false is DB work;
// instead check the edit wizard at /profile does NOT show it — onboarding-only prop)
await page.goto(`${BASE}/profile`);
await page.waitForLoadState("networkidle");
ok("mentor card absent in edit mode", (await page.locator("text=מגיעה בתור מנטורית? 👑").count()) === 0);

await browser.close();
console.log(results.join("\n"));
