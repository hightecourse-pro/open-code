// Post-release smoke on PRODUCTION public pages — render checks only, no
// accounts are created or touched there.
import { chromium } from "@playwright/test";
const BASE = "https://app.opencode.org.il";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(BASE + "/", { waitUntil: "networkidle" });
ok("home renders", (await page.locator("text=קוד פתוח").count()) > 0);
await page.screenshot({ path: `${SHOTS}/prod-1-home.png` });

await page.goto(BASE + "/login", { waitUntil: "networkidle" });
ok("login renders", (await page.locator('input[name="email"]').count()) === 1);

await page.goto(BASE + "/portal/login", { waitUntil: "networkidle" });
ok("portal login renders", (await page.locator('input[name="username"]').count()) === 1);
await page.screenshot({ path: `${SHOTS}/prod-2-portal-login.png` });

await browser.close();
console.log(results.join("\n"));
