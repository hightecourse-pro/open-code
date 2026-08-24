// Post-deploy check: the PM-round-4 UI, live on production, through שירה's
// demo account. Read-only — nothing is submitted.
import { chromium } from "@playwright/test";
const BASE = "https://app.opencode.org.il";
const SHOTS = process.env.SHOTS_DIR || ".";
const SHIRA_PASS = process.env.SHIRA_PASSWORD ?? (() => { console.error("set SHIRA_PASSWORD"); process.exit(1); })();
const results = [];
const ok = (n, p) => results.push(`${p ? "✅" : "❌"} ${n}`);
const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sh181861@gmail.com");
await page.fill('input[name="password"]', SHIRA_PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

// sidebar + forum layout
await page.goto(`${BASE}/forum`);
await page.waitForLoadState("networkidle");
const navTexts = (await page.locator("nav a").allTextContents()).map((t) => t.trim());
const idx = (t) => navTexts.findIndex((x) => x.includes(t));
ok("menu: recordings right after events", idx("הקלטות סשנים") === idx("אירועים וסשנים LIVE") + 1);
ok("menu: chats before subscription", idx("צ'אטים") > -1 && idx("צ'אטים") < idx("המנוי שלי"));
const searchBox = await page.locator('input[placeholder*="חיפוש לפי מילה"]').boundingBox();
const composerBox = await page.locator("form textarea, [contenteditable=true]").first().boundingBox();
ok("forum: search above composer", !!searchBox && !!composerBox && searchBox.y < composerBox.y);

// events: live session + past with recording
await page.goto(`${BASE}/events`);
await page.waitForLoadState("networkidle");
ok("events: LIVE badge on AI #2", (await page.locator("text=LIVE עכשיו").count()) > 0);
ok("events: join CTA", (await page.locator("text=מצטרפת עכשיו!").count()) > 0);
ok("events: syllabus link", (await page.locator('a:has-text("סילבוס")').count()) > 0);
ok("events: AI #1 marked הועבר", (await page.locator("text=הועבר").count()) > 0);
ok("events: AI #1 recording link", (await page.locator("text=לצפייה בהקלטה").count()) > 0);
ok("events: no premature feedback banner for live session",
  !((await page.locator("text=היית איתנו בסשן").first().textContent().catch(() => ""))?.includes("AI #2")));
await page.screenshot({ path: `${SHOTS}/prod-pm4-events.png` });

// jobs: targeted GRTH jobs, no letter logo
await page.goto(`${BASE}/jobs`);
await page.waitForLoadState("networkidle");
ok("jobs: targeted GRTH banner", (await page.locator("text=משרות בשבילך מקוד פתוח").count()) > 0);
ok("jobs: letter logo removed", (await page.locator("article .w-\\[42px\\]").count()) === 0);
await page.screenshot({ path: `${SHOTS}/prod-pm4-jobs.png` });

// courses syllabus + profile preview
const pdf = await page.request.get(`${BASE}/syllabus-2026.pdf`);
ok(`syllabus PDF serves (${pdf.status()})`, pdf.ok());
await page.goto(`${BASE}/profile/preview`);
await page.waitForLoadState("networkidle");
ok("profile preview renders", (await page.locator("text=תצוגה מקדימה").count()) > 0);

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("❌"));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
