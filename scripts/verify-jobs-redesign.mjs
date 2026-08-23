// Real-browser verification of the jobs-board redesign on deployed staging.
import { chromium } from "@playwright/test";
const requireEnv = (k) => process.env[k] ?? (() => { console.error(`set ${k}`); process.exit(1); })();
const PASS = requireEnv("VERIFY_FIXTURE_PASSWORD");
const BASE = "https://open-code-psi.vercel.app";
const SHOTS = process.env.SHOTS_DIR || ".";
const results = [];
const ok = (n, p, x = "") => results.push(`${p ? "✅" : "❌"} ${n}${x ? " — " + x : ""}`);

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

const browser = await chromium.launch();
process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exit(1); });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "sub.test@opencode.test");
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

// 1. the board: compact top, pills, filters, dates, match names
await page.goto(`${BASE}/jobs`);
await page.waitForLoadState("networkidle");
ok("view pills present", (await page.locator('a:has-text("ההגשות שלי")').count()) > 0 && (await page.locator('a:has-text("נשמרו")').count()) > 0);
ok("tech filter select", (await page.locator('select[aria-label="סינון לפי טכנולוגיה"]').count()) === 1);
ok("publish date on cards", (await page.locator("text=פורסמה").count()) > 0);
ok("single info line (no double banners)", (await page.locator("text=עדיפות למנויות הקהילה").count()) === 1);
await page.screenshot({ path: `${SHOTS}/jobs-1-board.png`, fullPage: true });

// 2. structured filter narrows the list
const techSel = page.locator('select[aria-label="סינון לפי טכנולוגיה"]');
const options = await techSel.locator("option").allTextContents();
if (options.length > 1) {
  await techSel.selectOption({ index: 1 });
  await page.waitForTimeout(250);
  ok("tech filter shows result count", (await page.locator("text=תוצא").count()) > 0);
  await techSel.selectOption({ index: 0 });
}

// 3. save a job → the saved view holds it
const bookmark = page.locator('article button[aria-label="שמירה"]').first();
if (await bookmark.count()) {
  await bookmark.click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/jobs?view=saved`);
  await page.waitForLoadState("networkidle");
  ok("saved view shows the saved job", (await page.locator("article").count()) > 0);
}

// 4. apply flow: no dup line, chat question link, new-tab helper links
await page.goto(`${BASE}/jobs/266739e7-e977-4504-bfc1-d537d3f736cc/apply`);
await page.waitForLoadState("networkidle");
ok("dup 'בלעדית' line gone on apply", (await page.locator("text=משרה בלעדית דרך קוד פתוח").count()) === 0);
ok("question→chat link present", (await page.locator('a:has-text("יש לך שאלה על המשרה")').count()) === 1);
ok("profile link opens new tab", (await page.locator('a[href="/profile"][target="_blank"]').count()) >= 1);
await page.screenshot({ path: `${SHOTS}/jobs-2-apply.png` });

// fill and submit (upload CV path — this account has no saved docs)
const fitBox = page.locator("#fit");
await fitBox.fill("יש לי רקע מתאים ואני מתרגשת להגיש 💜");
// answer any required job questions minimally
for (const ta of await page.locator('textarea[name^="q_"]').all()) await ta.fill("תשובה לבדיקה");
for (const num of await page.locator('input[type="number"][name^="q_"]').all()) await num.fill("2");
for (const group of await page.locator('input[type="radio"][name^="q_"]').all()) { await group.check().catch(() => {}); break; }
const fileInput = page.locator('input[type="file"][name="cv_file"]');
if (await fileInput.count()) {
  await fileInput.setInputFiles({ name: "cv-jobs-test.pdf", mimeType: "application/pdf", buffer: PDF });
}
await page.locator('button[type="submit"]:has-text("שליחת המועמדות")').click();
await page.waitForURL((u) => u.searchParams.get("applied") === "1", { timeout: 30000 });
ok("application submitted", true);

// 5. dedup + the mine view groups
await page.waitForLoadState("networkidle");
const cardTitles = await page.locator("article .font-display.text-\\[16px\\]").allTextContents();
ok("applied job left the board", !cardTitles.some((t) => t.includes("Junior Frontend Developer")));
await page.goto(`${BASE}/jobs?view=mine`);
await page.waitForLoadState("networkidle");
ok("mine view: בבדיקה group", (await page.locator("text=אצלנו בבדיקה").count()) > 0);
ok("mine view: honest forwarding line", (await page.locator("text=לא כל הגשה מועברת ללקוח").count()) > 0);
ok("mine view: application date", (await page.locator("text=הוגשה").count()) > 0);
await page.screenshot({ path: `${SHOTS}/jobs-3-mine.png` });

// 6. the uploaded CV landed in her profile documents (/cv)
await page.goto(`${BASE}/cv`);
await page.waitForLoadState("networkidle");
ok("apply-upload CV saved to her documents", (await page.locator("text=מותאם:").count()) > 0);

// 7. chat deep link from the question button
await page.goto(`${BASE}/jobs/8d46c4f9-1670-439e-b42b-902ae21f561c/apply`);
const chatHref = await page.locator('a:has-text("יש לך שאלה על המשרה")').getAttribute("href");
await page.goto(`${BASE}${chatHref}`);
await page.waitForURL((u) => !!u.searchParams.get("c"), { timeout: 25000 });
ok("question link opens a team conversation", true);
await page.screenshot({ path: `${SHOTS}/jobs-4-chat.png` });

await browser.close();
console.log(results.join("\n"));
