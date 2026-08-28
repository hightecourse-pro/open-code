// Read-only prod smoke after the Shira round: the new admin screens render.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://app.opencode.org.il";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sh181861@gmail.com");
await page.fill('input[name="password"]', requireEnv("SHIRA_PASSWORD"));
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/admin`);
await page.waitForLoadState("networkidle");
const nav = (await page.locator("nav").first().textContent()) ?? "";
ok("menu: 5 sections", ["קהילה", "ליווי", "השמה", "תוכן", "מערכת"].every((t) => nav.includes(t)));
await page.screenshot({ path: `${SHOTS}/prod-shira-menu.png` });

const screens = [
  ["/admin/alerts", "התראות", "לא נקרא"],
  ["/admin/requests", "פניות לצוות", "טופלו"],
  ["/admin/cv-files", "קורות חיים", "כל סוג"],
  ["/admin/submissions", "רשימת הגשות", "ייצוא לאקסל"],
  ["/admin/mentor-requests", "בקשות לליווי", "ליווי יזום"],
  ["/admin/mentors", "ניהול מנטוריות", "מינוי"],
  ["/admin/sessions", "ניהול סשנים", "סשן חדש"],
  ["/admin/config", "הגדרות", "דמי מנוי"],
];
for (const [path, name, marker] of screens) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  const body = (await page.textContent("body")) ?? "";
  ok(`${name} renders`, body.includes(marker));
}
await page.screenshot({ path: `${SHOTS}/prod-shira-last.png` });
await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `${failed.length} FAILED` : "ALL PASSED");
process.exit(failed.length ? 1 : 0);
