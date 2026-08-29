// Browser verification of PM round 3 on deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const ADMIN_PASS = requireEnv("QA_ADMIN_PASSWORD");
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

// ── member side ──────────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await login(page, "sub.test@opencode.test", PASS);
  await page.goto(`${BASE}/forum`);
  await page.waitForLoadState("networkidle");

  // menu: order + labels + subscription item
  const navTexts = await page.locator("nav a").allTextContents();
  const idx = (t) => navTexts.findIndex((x) => x.includes(t));
  ok("menu: jobs before events", idx("משרות") > -1 && idx("משרות") < idx("אירועים וסשנים LIVE"));
  ok("menu: events renamed LIVE", idx("אירועים וסשנים LIVE") > -1);
  ok("menu: articles last in section", idx("מאמרים") > idx("הקלטות"));
  ok("menu: המנוי שלי item", idx("המנוי שלי") > -1);

  // session feedback banner
  ok("feedback banner shown", (await page.locator("text=היית איתנו בסשן").count()) > 0);
}

// The full feedback-submission flow is owned by verify-pm-round4 (banner
// naming, dates, admin-worded + default questions) — pm3 stops at presence.
await browser.close();
console.log(results.join("\n"));
