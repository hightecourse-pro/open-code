// The probe is now profile_completed=false → the onboarding gate must show
// the mentor door on its FIRST step, and clicking it must load the mentor
// questionnaire.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "checkout.probe@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
await page.goto(`${BASE}/forum`);
await page.waitForLoadState("networkidle");
console.log("gate step shows mentor door:", (await page.locator("text=מגיעה בתור מנטורית? 👑").count()) === 1 ? "✅" : "❌");
await page.screenshot({ path: `${SHOTS}/flow-2-gate-mentor.png` });
await page.locator('button:has-text("מגיעה בתור מנטורית?")').click();
// The switch is a full server round trip + RSC refresh — wait for the junior
// gate to actually leave the tree.
await page.waitForSelector('text=אני בתחילת הדרך', { state: "detached", timeout: 20000 }).catch(() => {});
const mentorScope = (await page.locator("text=אני בתחילת הדרך").count()) === 0;
console.log("clicking switches to the mentor questionnaire:", mentorScope ? "✅ (junior gate gone)" : "❌");
await page.screenshot({ path: `${SHOTS}/flow-3-mentor-wizard.png` });
await browser.close();
