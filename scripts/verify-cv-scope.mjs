// The /cv screen must show ONLY the signed-in member's files — an admin used
// to see the entire community's CVs there, each with its owner's default badge.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const browser = await chromium.launch();

async function cvPage(email, passEnv, shot) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', requireEnv(passEnv));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  await page.goto(`${BASE}/cv`);
  await page.waitForLoadState("networkidle");
  const rows = await page.locator("div.flex-1.min-w-0 > div.font-medium").allTextContents();
  const badges = await page.locator('text="ברירת מחדל"').count();
  await page.screenshot({ path: `${SHOTS}/cv-scope-${shot}.png`, fullPage: true });
  await ctx.close();
  return { rows, badges };
}

const admin = await cvPage("admin.qa@opencode.test", "QA_ADMIN_PASSWORD", "admin");
console.log(`admin sees ${admin.rows.length} files, ${admin.badges} default badges:`, JSON.stringify(admin.rows));
// Files that belong to other members and used to leak onto the admin's screen.
const leaked = admin.rows.filter((r) => /שרה-בתיה|מרים רוס|בלאנק/.test(r));
console.log(leaked.length === 0 ? "✅ no other members' files" : `❌ LEAK: ${JSON.stringify(leaked)}`);
console.log(admin.rows.length === 1 && admin.badges === 1
  ? "✅ admin sees exactly her one file with one default badge"
  : `❌ admin sees ${admin.rows.length} files / ${admin.badges} badges`);

// sub.test owns exactly one job-tailored file that is NOT the default —
// so her list must show it, with no badge (and the promote button instead).
const member = await cvPage("sub.test@opencode.test", "QA_FIXTURE_PASSWORD", "member");
console.log(`sub.test sees ${member.rows.length} files, ${member.badges} default badges:`, JSON.stringify(member.rows));
console.log(member.rows.length === 1 && member.badges === 0 ? "✅ member sees only her file" : "❌ member view wrong");

await browser.close();
