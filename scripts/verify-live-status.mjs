// Staging check: a session with status='live' that STARTED 5 HOURS AGO must
// still show as live (badge, top list), never as "עברו", and must not raise
// the feedback banner. Fixture topic: LIVE-verify (cleaned by the caller).
import { chromium } from "@playwright/test";
const PASS = process.env.VERIFY_FIXTURE_PASSWORD ?? (() => { console.error("set VERIFY_FIXTURE_PASSWORD"); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sub.test@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/events`);
await page.waitForLoadState("networkidle");
const card = page.locator("div", { hasText: "בדיקת לייב ממושך" }).first();
ok("long-live session in upcoming with LIVE badge",
  (await page.locator('text=בדיקת לייב ממושך').count()) > 0 && (await page.locator("text=LIVE עכשיו").count()) > 0);
ok("lecturer topic visible", (await page.locator("text=מרצה: בודקת").count()) > 0);
const pastSection = page.locator("section", { hasText: "סשנים שעברו" });
ok("not listed under עברו",
  (await pastSection.count()) === 0 || !(await pastSection.first().textContent())?.includes("בדיקת לייב ממושך"));
const fb = await page.locator("text=היית איתנו בסשן").first().textContent().catch(() => "");
ok("no feedback banner for the live session", !(fb ?? "").includes("בדיקת לייב ממושך"));

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
