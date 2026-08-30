// The interview simulator is OFFLINE by the owner's call (2026-08-29): the
// session page redirects to the warm "בקרוב" screen. This script used to
// verify the key-page's next= link back into a session — that check comes
// back with the simulator (restore from git history at the comeback).
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SESSION = "eacb500f-9b4e-419b-8bd7-f5d024914047";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin.qa@opencode.test");
await page.fill('input[name="password"]', requireEnv("QA_ADMIN_PASSWORD"));
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
await page.goto(`${BASE}/ai/interview/${SESSION}`);
await page.waitForLoadState("networkidle");
const redirected = page.url().endsWith("/ai/interview");
const body = (await page.textContent("body")) ?? "";
console.log(redirected ? "✅ session page redirects to the offline screen" : "❌ session page did not redirect");
console.log(body.includes("בקרוב") ? "✅ בקרוב screen shown" : "❌ בקרוב copy missing");
await browser.close();
process.exit(redirected && body.includes("בקרוב") ? 0 : 1);
