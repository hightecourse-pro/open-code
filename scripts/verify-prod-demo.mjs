// Verify the production demo seed: שירה's login, the targeted GRTH jobs,
// the sessions, and the GRTH portal login. Read-only walk — nothing submitted.
import { chromium } from "@playwright/test";
const BASE = "https://app.opencode.org.il";
const SHOTS = process.env.SHOTS_DIR || ".";
const SHIRA_PASS = process.env.SHIRA_PASSWORD ?? (() => { console.error("set SHIRA_PASSWORD"); process.exit(1); })();
const GRTH_PASS = process.env.GRTH_PASSWORD ?? (() => { console.error("set GRTH_PASSWORD"); process.exit(1); })();
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "sh181861@gmail.com");
  await page.fill('input[name="password"]', SHIRA_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  ok("shira: login works", true);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");
  ok("shira: inside the community (composer visible)", (await page.locator("text=פתחי פוסט").count()) > 0);

  await page.goto(`${BASE}/jobs`);
  await page.waitForLoadState("networkidle");
  ok("jobs: targeted banner", (await page.locator("text=משרות בשבילך מקוד פתוח").count()) > 0);
  for (const t of ["פיתוח C# עם זיקה לחומרה", "פיתוח Embedded C++", "יישום וניתוח מערכות שכר"]) {
    ok(`jobs: "${t}"`, (await page.locator(`text=${t}`).count()) > 0);
  }
  await page.screenshot({ path: `${SHOTS}/prod-1-jobs.png` });

  await page.goto(`${BASE}/events`);
  await page.waitForLoadState("networkidle");
  ok("events: סשן AI #2 shown", (await page.locator("text=סשן AI #2").count()) > 0);
  ok("events: סשן AI #1 shown", (await page.locator("text=סשן AI #1").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/prod-2-events.png` });

  await page.goto(`${BASE}/recordings`);
  await page.waitForLoadState("networkidle");
  ok("recordings: AI #1 recording listed", (await page.locator("text=סדר בעולמות ה-AI").count()) > 0);

  await page.goto(`${BASE}/subscription`);
  await page.waitForLoadState("networkidle");
  ok("subscription: active", (await page.locator("text=פעיל").count()) > 0);
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}/portal/login`);
  await page.fill('input[name="username"]', "grth");
  await page.fill('input[name="password"]', GRTH_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/portal") && !u.pathname.includes("login"), { timeout: 25000 });
  ok("portal: GRTH login works", true);
  await page.goto(`${BASE}/portal/jobs`);
  await page.waitForLoadState("networkidle");
  ok("portal: GRTH sees its jobs", (await page.locator("text=Embedded").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/prod-3-portal.png` });
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
