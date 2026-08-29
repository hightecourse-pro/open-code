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

// The mentor door is ONBOARDING-only: assert it never shows in the edit
// wizard of a completed, ACTIVE member (sub.test — checkout.probe's canonical
// state is now the un-finished gate, where the door rightly DOES show).
const edit = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
await edit.goto(`${BASE}/login`);
await edit.fill('input[name="email"]', "sub.test@opencode.test");
await edit.fill('input[name="password"]', PASS);
await edit.click('button[type="submit"]');
await edit.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
await edit.goto(`${BASE}/profile`);
await edit.waitForLoadState("networkidle");
ok("mentor card absent in edit mode", (await edit.locator("text=מגיעה בתור מנטורית? 👑").count()) === 0);
await edit.close();

await browser.close();
console.log(results.join("\n"));
