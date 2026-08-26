// Browser verification of the miri tester round, on deployed staging.
import { chromium } from "@playwright/test";
const PASS = process.env.VERIFY_FIXTURE_PASSWORD;
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD;
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}

// ── subscriber member ────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page, "sub.test@opencode.test", PASS);

  await page.goto(`${BASE}/members`);
  await page.waitForLoadState("networkidle");
  ok("members: מנויה badge shows", (await page.locator("text=מנויה 💜").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/miri-members.png` });

  // Applied job must be OFF the board and ONLY in ההגשות שלי. Two distinct
  // jobs share this title — she applied to ONE, so exactly one card remains.
  await page.goto(`${BASE}/jobs`);
  await page.waitForLoadState("networkidle");
  const jfdCards = await page.locator('article:has-text("Junior Frontend Developer")').count();
  ok(`board: applied twin gone (1 of 2 remains, saw ${jfdCards})`, jfdCards === 1);
  await page.goto(`${BASE}/jobs?view=mine`);
  await page.waitForLoadState("networkidle");
  ok("mine: applied job listed", ((await page.textContent("body")) ?? "").includes("Junior Frontend Developer"));
  await page.close();
}

// ── mentor ───────────────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page, "mentor.test@opencode.test", PASS);
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState("networkidle");
  ok("mentor profile: 400-points promise", ((await page.textContent("body")) ?? "").includes("400 נקודות"));
  const nav = (await page.locator("nav").textContent()) ?? "";
  ok("mentor menu: jobs visible", nav.includes("משרות"));
  ok("mentor menu: courses still hidden", !nav.includes("ספריית קורסים"));
  await page.goto(`${BASE}/jobs`);
  await page.waitForLoadState("networkidle");
  ok("mentor jobs board opens", (await page.locator("text=כל המשרות").count()) > 0);
  await page.screenshot({ path: `${SHOTS}/miri-mentor-jobs.png` });
  await page.close();
}

// ── admin ────────────────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page, "admin.qa@opencode.test", ADMIN_PASS);
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState("networkidle");
  ok("dashboard: cubes are links", (await page.locator('a[href="/admin/members?status=pending"]').count()) > 0);
  await page.goto(`${BASE}/admin/members?status=pending`);
  await page.waitForLoadState("networkidle");
  const sel = await page.locator("select").first().inputValue().catch(() => "");
  ok(`members: status pre-filtered (${sel})`, sel === "pending");
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
